import { inngest } from '../client'
import { supabaseAdmin } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'

const PROCTOR_PROMPT = `You are an exam integrity AI. This image was taken from a student's phone rear camera during an online exam.

Your job is to confirm or deny a suspected violation. The ML system flagged: {flaggedLabel}

Check for these specific violations ONLY:
1. A second mobile phone or tablet (not the one filming)
2. Physical books, printed notes, or paper with writing
3. More than one person in the room
4. A second monitor or screen (other than the student's laptop)
5. The student has left their seat entirely

Respond ONLY with this exact JSON structure — nothing else:
{
  "violation": true | false,
  "type": "second_phone" | "notes_visible" | "second_person" | "second_monitor" | "student_absent" | "clear",
  "severity": "hard" | "soft",
  "confidence": "high" | "medium" | "low",
  "description": "One short sentence describing what you see"
}

If you are uncertain, set violation: false. Never guess. Never output anything other than the JSON.`

export const analyzeFrame = inngest.createFunction(
  {
    id: 'analyze-proctor-frame',
    concurrency: {
      limit: 10, // Max 10 concurrent Claude calls to prevent rate limits
    },
    retries: 3,
    triggers: [{ event: 'proctor/analyze.frame' }],
  },
  async ({ event, step }) => {
    const { sessionId, userId, filePath, flaggedLabel } = event.data

    // 1. Download image from Supabase Storage
    const base64Image = await step.run('download-image', async () => {
      const { data, error } = await supabaseAdmin
        .storage
        .from('proctor-frames')
        .download(filePath)

      if (error || !data) {
        throw new Error(`Failed to download image from storage: ${error?.message}`)
      }

      const arrayBuffer = await data.arrayBuffer()
      return Buffer.from(arrayBuffer).toString('base64')
    })

    // 2. Analyze with Claude Vision
    const claudeResult = await step.run('claude-vision', async () => {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      
      const response = await anthropic.messages.create({
        model: process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: PROCTOR_PROMPT.replace('{flaggedLabel}', flaggedLabel),
              },
            ],
          },
        ],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      return JSON.parse(text.trim()) as {
        violation: boolean
        type: string
        severity: string
        confidence: string
        description: string
      }
    })

    // 3. Save outcome and broadcast
    await step.run('save-and-broadcast', async () => {
      if (claudeResult.violation) {
        // Record event in database
        const { data: insertedEvent, error: insertError } = await supabaseAdmin
          .from('proctor_events')
          .insert({
            session_id: sessionId,
            user_id: userId,
            event_type: claudeResult.type,
            severity: claudeResult.severity,
            confidence: claudeResult.confidence === 'high' ? 0.9 : claudeResult.confidence === 'medium' ? 0.6 : 0.3,
            source: 'claude_vision',
            metadata: {
              description: claudeResult.description,
              flaggedLabel,
              filePath
            }
          })
          .select('id')
          .single()

        if (insertError) throw new Error('Failed to insert proctor_event')

        // Broadcast to realtime
        await supabaseAdmin.channel(`proctor:${sessionId}`).send({
          type: 'broadcast',
          event: 'violation',
          payload: {
            type: claudeResult.type,
            severity: claudeResult.severity,
            confidence: claudeResult.confidence,
            description: `📱 Mobile Camera (AI): ${claudeResult.description}`,
            source: 'claude_vision',
            eventId: insertedEvent.id
          },
        })

        // Log violation count
        await supabaseAdmin.rpc('increment_violation_count', {
          p_session_id: sessionId,
          p_user_id: userId,
        })
      } else {
        // False alarm confirmed — broadcast clear
        await supabaseAdmin.channel(`proctor:${sessionId}`).send({
          type: 'broadcast',
          event: 'clear',
          payload: { source: 'claude_vision', description: claudeResult.description },
        })
      }
    })

    // 4. Optionally delete image here or let lifecycle rules handle it.
    // Given the task mentions "lifecycle rules to delete frames after retention period", we will leave it in storage for audit.
    
    return { success: true, verdict: claudeResult.violation }
  }
)

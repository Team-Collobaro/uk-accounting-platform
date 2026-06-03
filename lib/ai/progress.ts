import type { Student, QuizResult, ProgressAnalysis } from '@/types'
import { client, MODEL } from './client'

export async function analyseProgress(params: {
  student: Student
  recentResults: QuizResult[]
  completedModules: string[]
}): Promise<ProgressAnalysis> {
  const { student, recentResults, completedModules } = params

  const prompt = `You are a learning progress analyst for a UK accounting course with 87 modules.
Analyse this student's performance and recommend next steps.

Student: ${student.name}
Completed modules: ${completedModules.length} of 87 (${Math.round((completedModules.length / 87) * 100)}%)
Average quiz score: ${student.avgQuizScore}%
Known weak topics: ${student.weakTopics.join(', ') || 'none'}

Recent quiz results (last ${recentResults.length}):
${recentResults
  .map(
    (r) =>
      `- Module ${r.moduleId}: ${r.percentage}% (${r.passed ? 'passed' : 'failed'}), weak areas: ${r.weakAreas.join(', ') || 'none'}`
  )
  .join('\n')}

Return ONLY valid JSON with no markdown:
{
  "recommendation": "proceed OR review OR exam",
  "reason": "brief explanation",
  "suggestedModule": "module id if review needed or null",
  "weakTopics": ["topic1", "topic2"],
  "overallProgress": percentage as number
}`

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : '{}'
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    return JSON.parse(cleaned) as ProgressAnalysis
  } catch {
    return {
      recommendation: 'proceed',
      reason: 'Unable to analyse at this time.',
      weakTopics: student.weakTopics,
      overallProgress: Math.round((completedModules.length / 87) * 100),
    }
  }
}

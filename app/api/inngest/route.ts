import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { analyzeFrame } from '@/inngest/functions/analyze_frame'

// Create an API that serves zero-downtime background jobs
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    analyzeFrame
  ],
})

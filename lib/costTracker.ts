import { supabaseAdmin } from './supabase-server'
import type { CostReport } from '@/types'
import { CLAUDE_MODEL, tokenPrice } from '@/lib/claude'

export function calculateCost(inputTokens: number, outputTokens: number): number {
  const price = tokenPrice()
  return inputTokens * price.input + outputTokens * price.output
}

export async function logUsage(
  studentId: string,
  sessionId: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  const costUsd = calculateCost(inputTokens, outputTokens)

  const { error: insertError } = await supabaseAdmin.from('token_usage').insert({
    student_id: studentId,
    session_id: sessionId,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: costUsd,
    model: CLAUDE_MODEL,
  })

  if (insertError) throw insertError

  // Increment total_tokens_used on the student row
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('total_tokens_used')
    .eq('id', studentId)
    .single()

  if (student) {
    await supabaseAdmin
      .from('students')
      .update({
        total_tokens_used: (student.total_tokens_used ?? 0) + inputTokens + outputTokens,
      })
      .eq('id', studentId)
  }
}

export async function getStudentCost(studentId: string): Promise<CostReport> {
  const { data, error } = await supabaseAdmin
    .from('token_usage')
    .select('input_tokens, output_tokens, cost_usd')
    .eq('student_id', studentId)

  if (error) throw error

  const rows = (data ?? []) as Array<{
    input_tokens: number
    output_tokens: number
    cost_usd: number
  }>

  const totalInputTokens = rows.reduce((s, r) => s + r.input_tokens, 0)
  const totalOutputTokens = rows.reduce((s, r) => s + r.output_tokens, 0)
  const totalCostUsd = rows.reduce((s, r) => s + Number(r.cost_usd), 0)
  const sessionCount = rows.length
  const avgCostPerSession = sessionCount > 0 ? totalCostUsd / sessionCount : 0

  return {
    studentId,
    totalInputTokens,
    totalOutputTokens,
    totalCostUsd,
    sessionCount,
    avgCostPerSession,
  }
}

export async function getMonthlyTotal(): Promise<number> {
  const start = new Date()
  start.setDate(1)
  start.setHours(0, 0, 0, 0)

  const { data, error } = await supabaseAdmin
    .from('token_usage')
    .select('cost_usd')
    .gte('created_at', start.toISOString())

  if (error) throw error

  return (data ?? []).reduce(
    (sum, row: { cost_usd: number }) => sum + Number(row.cost_usd),
    0
  )
}

import { supabaseAdmin } from '@/lib/supabase-server'
import { MODULE_ID_PATTERN } from '@/lib/quiz-security'

export function moduleNumber(moduleId: string): number | null {
  if (!MODULE_ID_PATTERN.test(moduleId)) return null
  return Number(moduleId.slice(1))
}

export function previousModuleId(moduleId: string): string | null {
  const number = moduleNumber(moduleId)
  if (!number || number === 1) return null
  return `m${String(number - 1).padStart(2, '0')}`
}

export async function canAccessModule(studentId: string, moduleId: string): Promise<boolean> {
  const prerequisite = previousModuleId(moduleId)
  if (!prerequisite) return moduleId === 'm01'

  const { data, error } = await supabaseAdmin
    .from('module_progress')
    .select('module_id')
    .eq('student_id', studentId)
    .eq('module_id', prerequisite)
    .eq('status', 'completed')
    .maybeSingle()

  if (error) throw error
  return Boolean(data)
}

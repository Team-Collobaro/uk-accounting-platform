import { createServerClient } from '@supabase/ssr'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'
import type {
  Student,
  ModuleProgress,
  TutorSession,
  ChatMessage,
  QuizResult,
  Certificate,
} from '@/types'

// Read lazily so scripts can load .env before importing this module
const getSupabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL!
const getAnonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const getServiceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY!

// Server component client (reads cookies, respects RLS)
export async function createServerSupabaseClient() {
  const { cookies } = await import('next/headers')
  const cookieStore = cookies()
  return createServerClient(getSupabaseUrl(), getAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
          )
        } catch {
          // In Server Components, cookies cannot be set — safe to ignore
        }
      },
    },
  })
}

// Admin client — service role key, bypasses RLS (lazy singleton so scripts can dotenv first)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _supabaseAdmin: SupabaseClient<any> | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabaseAdmin = new Proxy({} as SupabaseClient<any>, {
  get(_target, prop) {
    if (!_supabaseAdmin) {
      _supabaseAdmin = createSupabaseClient(getSupabaseUrl(), getServiceKey(), { auth: { persistSession: false } })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (_supabaseAdmin as any)[prop]
  },
})

// ─── Typed helpers ────────────────────────────────────────────────────────────

export async function getStudent(userId: string): Promise<Student> {
  const { data, error } = await supabaseAdmin
    .from('students')
    .select('*')
    .eq('id', userId)
    .single()

  if (!error && data) {
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      enrolledCourses: data.enrolled_courses ?? [],
      completedModules: data.completed_modules ?? [],
      weakTopics: data.weak_topics ?? [],
      avgQuizScore: data.avg_quiz_score ?? 0,
      totalTokensUsed: data.total_tokens_used ?? 0,
      createdAt: new Date(data.created_at),
    }
  }

  // Row missing (e.g. user created via Supabase dashboard) — auto-create it
  if (error?.code === 'PGRST116') {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId)
    const email = authUser?.user?.email ?? ''
    const name = authUser?.user?.user_metadata?.name ?? email.split('@')[0] ?? 'Student'

    const { data: created, error: insertError } = await supabaseAdmin
      .from('students')
      .insert({ id: userId, name, email })
      .select()
      .single()

    if (insertError) throw insertError

    return {
      id: created.id,
      name: created.name,
      email: created.email,
      enrolledCourses: [],
      completedModules: [],
      weakTopics: [],
      avgQuizScore: 0,
      totalTokensUsed: 0,
      createdAt: new Date(created.created_at),
    }
  }

  throw error
}

export async function updateStudent(
  userId: string,
  data: Partial<Student>
): Promise<void> {
  const mapped: Record<string, unknown> = {}
  if (data.name !== undefined) mapped.name = data.name
  if (data.enrolledCourses !== undefined) mapped.enrolled_courses = data.enrolledCourses
  if (data.completedModules !== undefined) mapped.completed_modules = data.completedModules
  if (data.weakTopics !== undefined) mapped.weak_topics = data.weakTopics
  if (data.avgQuizScore !== undefined) mapped.avg_quiz_score = data.avgQuizScore
  if (data.totalTokensUsed !== undefined) mapped.total_tokens_used = data.totalTokensUsed
  mapped.updated_at = new Date().toISOString()

  const { error } = await supabaseAdmin
    .from('students')
    .update(mapped)
    .eq('id', userId)

  if (error) throw error
}

export async function getModuleProgress(
  studentId: string
): Promise<ModuleProgress[]> {
  const { data, error } = await supabaseAdmin
    .from('module_progress')
    .select('*')
    .eq('student_id', studentId)

  if (error) throw error

  return (data ?? []).map((row: Record<string, unknown>) => ({
    moduleId: row.module_id as string,
    studentId: row.student_id as string,
    status: row.status as ModuleProgress['status'],
    quizScore: row.quiz_score as number | undefined,
    completedAt: row.completed_at as string | undefined,
  }))
}

export async function updateModuleProgress(
  studentId: string,
  moduleId: string,
  data: Partial<ModuleProgress>
): Promise<void> {
  const mapped: Record<string, unknown> = {
    student_id: studentId,
    module_id: moduleId,
  }
  if (data.status !== undefined) mapped.status = data.status
  if (data.quizScore !== undefined) mapped.quiz_score = data.quizScore
  if (data.completedAt !== undefined) mapped.completed_at = data.completedAt

  const { error } = await supabaseAdmin
    .from('module_progress')
    .upsert(mapped, { onConflict: 'student_id,module_id' })

  if (error) throw error
}

export async function saveSession(
  session: Partial<TutorSession>
): Promise<TutorSession> {
  const mapped: Record<string, unknown> = {
    student_id: session.studentId,
    module_id: session.moduleId,
    messages: session.messages ?? [],
    total_tokens: session.totalTokens ?? 0,
    total_cost_usd: session.totalCostUsd ?? 0,
  }

  const { data, error } = await supabaseAdmin
    .from('tutor_sessions')
    .insert(mapped)
    .select()
    .single()

  if (error) throw error

  return {
    id: data.id,
    studentId: data.student_id,
    moduleId: data.module_id,
    messages: data.messages ?? [],
    totalTokens: data.total_tokens,
    totalCostUsd: data.total_cost_usd,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

export async function updateSession(
  sessionId: string,
  messages: ChatMessage[],
  tokens: number,
  cost: number
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('tutor_sessions')
    .update({
      messages,
      total_tokens: tokens,
      total_cost_usd: cost,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  if (error) throw error
}

export async function saveQuizResult(
  result: Partial<QuizResult>
): Promise<QuizResult> {
  const mapped: Record<string, unknown> = {
    student_id: result.studentId,
    module_id: result.moduleId,
    score: result.score,
    total: result.total,
    percentage: result.percentage,
    passed: result.passed,
    weak_areas: result.weakAreas ?? [],
  }

  const { data, error } = await supabaseAdmin
    .from('quiz_results')
    .insert(mapped)
    .select()
    .single()

  if (error) throw error

  return {
    id: data.id,
    moduleId: data.module_id,
    studentId: data.student_id,
    score: data.score,
    total: data.total,
    percentage: data.percentage,
    passed: data.passed,
    weakAreas: data.weak_areas ?? [],
    completedAt: data.completed_at,
  }
}

export async function getCertificate(
  verificationCode: string
): Promise<Certificate | null> {
  const { data, error } = await supabaseAdmin
    .from('certificates')
    .select('*')
    .eq('verification_code', verificationCode)
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    studentId: data.student_id,
    studentName: data.student_name,
    courseTitle: data.course_title,
    completionDate: data.completion_date,
    verificationCode: data.verification_code,
    verificationUrl: data.verification_url,
    finalScore: data.final_score,
    isValid: data.is_valid,
  }
}

export async function saveCertificate(
  cert: Partial<Certificate>
): Promise<Certificate> {
  const mapped: Record<string, unknown> = {
    student_id: cert.studentId,
    student_name: cert.studentName,
    course_title: cert.courseTitle,
    verification_code: cert.verificationCode,
    verification_url: cert.verificationUrl,
    final_score: cert.finalScore,
    is_valid: cert.isValid ?? true,
  }

  const { data, error } = await supabaseAdmin
    .from('certificates')
    .insert(mapped)
    .select()
    .single()

  if (error) throw error

  return {
    id: data.id,
    studentId: data.student_id,
    studentName: data.student_name,
    courseTitle: data.course_title,
    completionDate: data.completion_date,
    verificationCode: data.verification_code,
    verificationUrl: data.verification_url,
    finalScore: data.final_score,
    isValid: data.is_valid,
  }
}

export async function trackTokenUsage(
  studentId: string,
  sessionId: string,
  inputTokens: number,
  outputTokens: number,
  model: string
): Promise<void> {
  const costUsd =
    (inputTokens / 1_000_000) * 1.0 + (outputTokens / 1_000_000) * 5.0

  const { error: insertError } = await supabaseAdmin.from('token_usage').insert({
    student_id: studentId,
    session_id: sessionId,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: costUsd,
    model,
  })

  if (insertError) throw insertError

  const { data: student } = await supabaseAdmin
    .from('students')
    .select('total_tokens_used')
    .eq('id', studentId)
    .single()

  if (student) {
    await supabaseAdmin
      .from('students')
      .update({ total_tokens_used: (student.total_tokens_used ?? 0) + inputTokens + outputTokens })
      .eq('id', studentId)
  }
}

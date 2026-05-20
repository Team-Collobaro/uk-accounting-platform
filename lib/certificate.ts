import { supabaseAdmin } from './supabase-server'
import type { Student, Certificate } from '@/types'

const TOTAL_MODULES = 87
const PASS_THRESHOLD = 70

export async function isEligible(studentId: string): Promise<boolean> {
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('completed_modules')
    .eq('id', studentId)
    .single()

  if (!student) return false
  const completed: string[] = student.completed_modules ?? []
  if (completed.length < TOTAL_MODULES) return false

  // Check final module (m87) quiz passed with >= 70%
  const { data: finalQuiz } = await supabaseAdmin
    .from('quiz_results')
    .select('percentage, passed')
    .eq('student_id', studentId)
    .eq('module_id', 'm87')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single()

  if (!finalQuiz) return false
  return finalQuiz.passed && Number(finalQuiz.percentage) >= PASS_THRESHOLD
}

export async function generateCertificate(
  student: Student,
  finalScore: number
): Promise<Certificate> {
  const verificationCode = crypto.randomUUID()
  const verificationUrl =
    `${process.env.NEXT_PUBLIC_APP_URL}/verify/${verificationCode}`

  const { data, error } = await supabaseAdmin
    .from('certificates')
    .insert({
      student_id: student.id,
      student_name: student.name,
      course_title: 'UK Bookkeeping, Accounting & Taxation',
      verification_code: verificationCode,
      verification_url: verificationUrl,
      final_score: finalScore,
      is_valid: true,
    })
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

function formatDate(iso: string): string {
  const d = new Date(iso)
  const day = d.getDate()
  const suffix =
    day % 10 === 1 && day !== 11 ? 'st'
    : day % 10 === 2 && day !== 12 ? 'nd'
    : day % 10 === 3 && day !== 13 ? 'rd'
    : 'th'
  const month = d.toLocaleString('en-GB', { month: 'long' })
  const year = d.getFullYear()
  return `${day}${suffix} ${month} ${year}`
}

export function getCertificateHTML(cert: Certificate): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Certificate — ${cert.studentName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@300;400;600&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #f5f0e8;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: 'Inter', sans-serif;
      padding: 2rem;
    }

    .certificate {
      background: #fff;
      width: 800px;
      padding: 60px 80px;
      border: 3px solid #1e3a8a;
      box-shadow: 0 0 0 10px #f5f0e8, 0 0 0 13px #1e3a8a;
      text-align: center;
      position: relative;
    }

    .corner {
      position: absolute;
      width: 60px;
      height: 60px;
      border-color: #1d4ed8;
      border-style: solid;
    }
    .corner-tl { top: 12px; left: 12px; border-width: 3px 0 0 3px; }
    .corner-tr { top: 12px; right: 12px; border-width: 3px 3px 0 0; }
    .corner-bl { bottom: 12px; left: 12px; border-width: 0 0 3px 3px; }
    .corner-br { bottom: 12px; right: 12px; border-width: 0 3px 3px 0; }

    .logo { font-size: 13px; letter-spacing: 4px; text-transform: uppercase; color: #1e3a8a; margin-bottom: 24px; }
    .divider { width: 80px; height: 2px; background: #1d4ed8; margin: 20px auto; }
    .heading { font-family: 'Playfair Display', serif; font-size: 36px; color: #1e3a8a; margin-bottom: 8px; }
    .subtitle { font-size: 13px; letter-spacing: 2px; text-transform: uppercase; color: #64748b; margin-bottom: 32px; }
    .certify-text { font-size: 15px; color: #475569; margin-bottom: 16px; }
    .student-name { font-family: 'Playfair Display', serif; font-size: 48px; font-style: italic; color: #1e3a8a; margin: 8px 0 24px; }
    .course-title { font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 4px; }
    .course-hours { font-size: 14px; color: #64748b; margin-bottom: 32px; }
    .score-date { font-size: 15px; color: #475569; margin-bottom: 40px; }
    .score-date strong { color: #1e3a8a; }
    .verify { font-size: 11px; color: #94a3b8; line-height: 1.6; border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 20px; }
    .verify a { color: #3b82f6; text-decoration: none; }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="corner corner-tl"></div>
    <div class="corner corner-tr"></div>
    <div class="corner corner-bl"></div>
    <div class="corner corner-br"></div>

    <p class="logo">UK Accounting Pro</p>
    <div class="divider"></div>
    <h1 class="heading">Certificate of Completion</h1>
    <p class="subtitle">150-Hour Professional Development Programme</p>

    <p class="certify-text">This is to certify that</p>
    <p class="student-name">${cert.studentName}</p>
    <p class="certify-text">has successfully completed the course</p>
    <div class="divider"></div>

    <p class="course-title">${cert.courseTitle}</p>
    <p class="course-hours">Comprehensive UK Bookkeeping, Accounting &amp; Taxation</p>

    <p class="score-date">
      Completed on <strong>${formatDate(cert.completionDate)}</strong>
      &nbsp;·&nbsp; Final score: <strong>${cert.finalScore}%</strong>
    </p>

    <div class="verify">
      <p>Verification code: <strong>${cert.verificationCode}</strong></p>
      <p>Verify at: <a href="${cert.verificationUrl}">${cert.verificationUrl}</a></p>
    </div>
  </div>
</body>
</html>`
}

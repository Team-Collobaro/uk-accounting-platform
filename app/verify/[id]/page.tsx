import { notFound } from 'next/navigation'
import { getCertificate } from '@/lib/supabase-server'
import { CheckCircle2, XCircle, Shield, Calendar, User, Award } from 'lucide-react'

export const dynamic = 'force-dynamic'

function formatDate(iso: string): string {
  const d = new Date(iso)
  const day = d.getDate()
  const suffix =
    day % 10 === 1 && day !== 11 ? 'st'
    : day % 10 === 2 && day !== 12 ? 'nd'
    : day % 10 === 3 && day !== 13 ? 'rd'
    : 'th'
  return `${day}${suffix} ${d.toLocaleString('en-GB', { month: 'long' })} ${d.getFullYear()}`
}

export default async function VerifyPage({ params }: { params: { id: string } }) {
  const certificate = await getCertificate(params.id)

  if (!certificate) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle size={32} className="text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Certificate Not Found</h1>
          <p className="text-slate-500 text-sm">
            No valid certificate exists for code <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{params.id}</code>.
            Please check the verification link and try again.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden">
        {/* Verified banner */}
        <div className="bg-emerald-600 px-8 py-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <Shield size={24} className="text-white" />
          </div>
          <div>
            <p className="text-emerald-100 text-xs font-semibold uppercase tracking-widest">Authenticity verified</p>
            <h1 className="text-white text-xl font-bold">VERIFIED CERTIFICATE</h1>
          </div>
          <CheckCircle2 size={28} className="text-white ml-auto" />
        </div>

        {/* Certificate details */}
        <div className="px-8 py-8 space-y-6">
          <div className="text-center">
            <p className="text-sm text-slate-500 uppercase tracking-widest mb-1">This certifies that</p>
            <h2 className="text-3xl font-bold text-slate-800">{certificate.studentName}</h2>
            <p className="text-slate-500 mt-1">has successfully completed</p>
          </div>

          <div className="text-center bg-brand-50 rounded-xl py-5 px-6 border border-brand-100">
            <p className="font-bold text-brand-900 text-lg">{certificate.courseTitle}</p>
            <p className="text-brand-600 text-sm mt-1">150-Hour Professional Development Programme</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: User,     label: 'Student',   value: certificate.studentName },
              { icon: Calendar, label: 'Completed', value: formatDate(certificate.completionDate) },
              { icon: Award,    label: 'Final score', value: `${certificate.finalScore}%` },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="text-center">
                <Icon size={16} className="text-slate-400 mx-auto mb-1" />
                <p className="text-xs text-slate-400">{label}</p>
                <p className="text-sm font-semibold text-slate-700 mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 pt-5 text-center space-y-1">
            <p className="text-xs text-slate-400">Verification code</p>
            <p className="font-mono text-sm text-slate-600 bg-slate-50 rounded-lg py-2 px-4 inline-block">
              {certificate.verificationCode}
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Verified at: <span className="text-brand-600">{certificate.verificationUrl}</span>
            </p>
          </div>
        </div>

        <div className="bg-slate-50 px-8 py-4 text-center">
          <p className="text-xs text-slate-400">
            UK Accounting Pro · Issued by AI-Powered Professional Learning Platform · {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  )
}

import Link from 'next/link'
import { BookOpen, Brain, Award, Shield, CheckCircle2, Users, TrendingUp } from 'lucide-react'

const features = [
  {
    icon: Brain,
    title: 'AI Tutor — Alex',
    desc: 'Socratic teaching style that guides you to answers with questions, not lectures. Powered by Claude Haiku.',
  },
  {
    icon: BookOpen,
    title: '87 Structured Modules',
    desc: 'Across 12 parts covering every aspect of UK bookkeeping, VAT, payroll, corporation tax and personal tax.',
  },
  {
    icon: Award,
    title: 'Verified Certificate',
    desc: 'Earn a publicly verifiable certificate employers can check instantly via a unique URL.',
  },
  {
    icon: Shield,
    title: 'RAG-Powered Accuracy',
    desc: 'Every AI answer is grounded in your course content — no hallucinated tax rates or made-up legislation.',
  },
  {
    icon: TrendingUp,
    title: 'Adaptive Quizzes',
    desc: 'Quizzes adapt to your weak areas. The AI tracks your progress and suggests what to review next.',
  },
  {
    icon: Users,
    title: 'Employer Portal',
    desc: "Manage your whole team's progress, download CSV reports, and verify certificates in bulk.",
  },
]

const parts = [
  'UK Compliance Landscape', 'Double-Entry Bookkeeping', 'VAT & Indirect Taxes',
  'Payroll & PAYE', 'Management Accounting', 'Financial Statements',
  'Company Law & Governance', 'Corporation Tax', 'Personal Tax',
  'Capital Gains Tax', 'Audit & Assurance', 'Professional Ethics & Standards',
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-slate-100 sticky top-0 bg-white/90 backdrop-blur z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-brand-700 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">UK</span>
            </div>
            <span className="font-semibold text-slate-800 text-lg">Accounting Pro</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-slate-600 hover:text-slate-800 font-medium transition">
              Sign in
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-24 px-4 text-center bg-gradient-to-b from-brand-50/50">
        <span className="inline-block text-xs font-semibold text-brand-600 bg-brand-100 px-3 py-1 rounded-full mb-6 uppercase tracking-widest">
          AI-Powered · UK Focused · 150 Hours
        </span>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 mb-6 leading-tight">
          Master UK Accounting<br />
          <span className="text-brand-600">with an AI Tutor</span>
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-10">
          87 modules. 12 subject areas. An AI tutor that teaches the Socratic way —
          asking questions, not reciting answers. Earn a verifiable certificate upon completion.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/register"
            className="px-8 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl text-base transition shadow-lg shadow-brand-200"
          >
            Create free account
          </Link>
          <Link
            href="/login"
            className="px-8 py-3.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-base transition"
          >
            Already enrolled
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-800 text-center mb-12">
            Everything you need to pass
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-slate-50 rounded-2xl p-6 hover:bg-brand-50 transition-colors group">
                <div className="w-12 h-12 bg-brand-100 group-hover:bg-brand-200 rounded-xl flex items-center justify-center mb-4 transition-colors">
                  <Icon size={22} className="text-brand-700" />
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Curriculum */}
      <section className="py-20 px-4 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-800 text-center mb-4">Full curriculum</h2>
          <p className="text-slate-500 text-center mb-12">87 modules across 12 professional subject areas</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {parts.map((part, i) => (
              <div key={part} className="flex items-center gap-3 bg-white rounded-xl p-4 border border-slate-200">
                <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                <span className="text-sm font-medium text-slate-700">{part}</span>
                <CheckCircle2 size={16} className="text-emerald-400 ml-auto shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-brand-900 text-center">
        <h2 className="text-3xl font-bold text-white mb-4">Ready to start?</h2>
        <p className="text-brand-200 mb-8 max-w-lg mx-auto">
          Join professionals upgrading their UK accounting skills with the power of AI-guided learning.
        </p>
        <Link
          href="/register"
          className="px-8 py-3.5 bg-white text-brand-700 font-semibold rounded-xl hover:bg-brand-50 transition text-base"
        >
          Create your free account
        </Link>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-slate-200 text-center text-sm text-slate-400">
        <p>© {new Date().getFullYear()} UK Accounting Pro · AI-Powered Professional Learning</p>
      </footer>
    </div>
  )
}

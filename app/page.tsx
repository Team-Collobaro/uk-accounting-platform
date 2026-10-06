import type { Metadata } from 'next'
import LandingPage from '@/components/landing/LandingPage'

export const metadata: Metadata = {
  title: 'UKATI | UK Accounting & Taxation Courses with an AI Tutor',
  description:
    'Train for a career in UK accounting and tax. 87 guided modules across 12 parts, a personal AI tutor, proctored exams and verifiable certificates from UKATI.',
}

export default function Home() {
  return <LandingPage />
}

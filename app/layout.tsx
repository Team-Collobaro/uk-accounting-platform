import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'UK Accounting Pro — AI-Powered Learning Platform',
  description:
    '150-hour professional UK bookkeeping, accounting and taxation course with AI tutor.',
  icons: { icon: [] },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}

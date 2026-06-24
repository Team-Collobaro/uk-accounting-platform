import type { Metadata } from 'next'
import './globals.css'
import ContentProtection from '@/components/ContentProtection'
import { ThemeProvider } from '@/context/ThemeContext'

export const metadata: Metadata = {
  title: 'UK Accounting Pro — AI-Powered Learning Platform',
  description:
    '150-hour professional UK bookkeeping, accounting and taxation course with AI tutor.',
  icons: { icon: [] },
}

/**
 * Inline script injected into <head> — runs synchronously before first paint.
 * Reads the persisted theme preference from localStorage and sets data-theme
 * on <html> immediately, preventing a flash-of-wrong-theme (FOWT) on load.
 */
const antiFowtScript = `
(function() {
  try {
    var t = localStorage.getItem('uk-acct-theme') || 'dark';
    var e = t === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : t;
    document.documentElement.setAttribute('data-theme', e);
  } catch (_) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <head>
        {/* Anti-flash: sets data-theme before CSS is applied */}
        <script dangerouslySetInnerHTML={{ __html: antiFowtScript }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <ContentProtection />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}


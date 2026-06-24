'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

export type ThemeChoice    = 'dark' | 'light' | 'system'
export type EffectiveTheme = 'dark' | 'light'

interface ThemeCtx {
  /** What the user explicitly chose */
  theme: ThemeChoice
  /** The resolved, effective theme (system → dark|light) */
  effective: EffectiveTheme
  setTheme: (t: ThemeChoice) => void
}

const ThemeContext = createContext<ThemeCtx>({
  theme: 'dark',
  effective: 'dark',
  setTheme: () => {},
})

function resolveEffective(choice: ThemeChoice): EffectiveTheme {
  if (choice !== 'system') return choice
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function applyToDOM(effective: EffectiveTheme) {
  document.documentElement.setAttribute('data-theme', effective)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme,     setThemeState] = useState<ThemeChoice>('dark')
  const [effective, setEffective]  = useState<EffectiveTheme>('dark')

  // On mount — read persisted preference
  useEffect(() => {
    const saved = (localStorage.getItem('uk-acct-theme') ?? 'dark') as ThemeChoice
    const eff   = resolveEffective(saved)
    setThemeState(saved)
    setEffective(eff)
    applyToDOM(eff)
  }, [])

  const setTheme = useCallback((t: ThemeChoice) => {
    localStorage.setItem('uk-acct-theme', t)
    const eff = resolveEffective(t)
    setThemeState(t)
    setEffective(eff)
    applyToDOM(eff)
  }, [])

  // When system mode is active, watch OS preference changes
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const handler = () => {
      const eff = resolveEffective('system')
      setEffective(eff)
      applyToDOM(eff)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, effective, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)

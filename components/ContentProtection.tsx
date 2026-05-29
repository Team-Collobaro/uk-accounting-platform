'use client'

import { useEffect } from 'react'

export default function ContentProtection() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return

    // Block right-click context menu
    const noContext = (e: MouseEvent) => e.preventDefault()

    // Block copy/cut/paste keyboard shortcuts and PrintScreen
    const noKeys = (e: KeyboardEvent) => {
      const key = (e.key ?? '').toLowerCase()

      // PrintScreen
      if (e.key === 'PrintScreen') {
        e.preventDefault()
        // Briefly blank the clipboard on Windows
        navigator.clipboard?.writeText('').catch(() => {})
        return
      }

      // Ctrl/Cmd combos: U (view-source), S (save), P (print)
      if ((e.ctrlKey || e.metaKey) && ['u', 's', 'p'].includes(key)) {
        e.preventDefault()
        return
      }

      // F12 devtools
      if (e.key === 'F12') {
        e.preventDefault()
      }
    }

    // Block drag-to-copy
    const noDrag = (e: DragEvent) => e.preventDefault()

    document.addEventListener('contextmenu', noContext)
    document.addEventListener('keydown', noKeys)
    document.addEventListener('dragstart', noDrag)

    return () => {
      document.removeEventListener('contextmenu', noContext)
      document.removeEventListener('keydown', noKeys)
      document.removeEventListener('dragstart', noDrag)
    }
  }, [])

  return null
}

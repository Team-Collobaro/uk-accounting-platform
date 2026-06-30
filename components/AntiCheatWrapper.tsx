'use client'

import React, { useState, useEffect } from 'react'
import { ShieldAlert } from 'lucide-react'

interface AntiCheatWrapperProps {
  children: React.ReactNode
  isViolatingProctoring?: boolean
  proctoringWarning?: string
}

export default function AntiCheatWrapper({
  children,
  isViolatingProctoring = false,
  proctoringWarning = ''
}: AntiCheatWrapperProps) {
  const [isBlurredBySystem, setIsBlurredBySystem] = useState(false)
  const [systemWarning, setSystemWarning] = useState('')

  const isBlurred = isBlurredBySystem || isViolatingProctoring
  const warningMessage = systemWarning || proctoringWarning

  useEffect(() => {
    // 1. Handle window blur (screenshot tool opening, switching tabs)
    const handleBlur = () => {
      setIsBlurredBySystem(true)
      setSystemWarning('Content hidden. Please return to the window to continue.')
    }

    const handleFocus = () => {
      setIsBlurredBySystem(false)
      setSystemWarning('')
    }

    // 2. Handle specific keyboard shortcuts for screenshots
    const handleKeyDown = (e: KeyboardEvent) => {
      // Proactively blur if they hold Cmd+Shift or Win+Shift
      if (e.metaKey && e.shiftKey) {
        setIsBlurredBySystem(true)
        setSystemWarning('Screenshot shortcut detected.')
      }

      // PrintScreen key (Windows)
      if (e.key === 'PrintScreen') {
        setIsBlurredBySystem(true)
        setSystemWarning('Screenshots are not permitted on Knowledge Checks.')
        e.preventDefault()
        navigator.clipboard.writeText('') // Clear clipboard just in case
      }

      // Ctrl+C, Cmd+C (Copy)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.metaKey || !e.shiftKey) {
        if (systemWarning === 'Screenshot shortcut detected.') {
          setTimeout(() => {
            if (document.hasFocus()) {
              setIsBlurredBySystem(false)
              setSystemWarning('')
            }
          }, 1000)
        }
      }
    }

    // 3. Handle copy event
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault()
      e.clipboardData?.setData('text/plain', 'Copying is disabled.')
    }

    // 4. Handle right click
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }

    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    document.addEventListener('copy', handleCopy)
    document.addEventListener('contextmenu', handleContextMenu)

    return () => {
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [systemWarning])

  return (
    <div className="anti-cheat-container no-copy relative">
      {isBlurred && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-xl rounded-lg border border-slate-700 mt-20">
          <div className="text-center p-8">
            <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Security Protection Active</h2>
            <p className="text-slate-300">{warningMessage || 'Content is hidden.'}</p>
          </div>
        </div>
      )}
      <div className={`transition-all duration-200 ${isBlurred ? 'opacity-0 blur-md select-none' : 'opacity-100'}`}>
        {children}
      </div>
    </div>
  )
}

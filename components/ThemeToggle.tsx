'use client'

import { Sun, Moon, Monitor } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme, type ThemeChoice } from '@/context/ThemeContext'

const OPTIONS: { value: ThemeChoice; Icon: typeof Sun; label: string }[] = [
  { value: 'light',  Icon: Sun,     label: 'Light'  },
  { value: 'system', Icon: Monitor, label: 'System' },
  { value: 'dark',   Icon: Moon,    label: 'Dark'   },
]

interface ThemeToggleProps {
  /** When true renders a compact icon-only cycling button (for collapsed sidebar) */
  collapsed?: boolean
}

export default function ThemeToggle({ collapsed = false }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()

  if (collapsed) {
    // Collapsed: single icon button that cycles Light → System → Dark → Light
    const currentIdx = OPTIONS.findIndex(o => o.value === theme)
    const current    = OPTIONS[currentIdx] ?? OPTIONS[2]
    const next       = OPTIONS[(currentIdx + 1) % OPTIONS.length]
    const { Icon }   = current

    return (
      <motion.button
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.90 }}
        onClick={() => setTheme(next.value)}
        title={`Theme: ${current.label} (click for ${next.label})`}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 10,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          cursor: 'pointer',
          color: 'var(--ac-cyan)',
          transition: 'background 0.2s, border-color 0.2s',
        }}
      >
        <Icon size={15} />
      </motion.button>
    )
  }

  // Expanded: full 3-way segmented control
  return (
    <div
      role="group"
      aria-label="Colour theme"
      style={{
        display: 'flex',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 11,
        padding: 3,
        gap: 2,
        position: 'relative',
      }}
    >
      {OPTIONS.map(({ value, Icon, label }) => {
        const active = theme === value
        return (
          <motion.button
            key={value}
            onClick={() => setTheme(value)}
            whileHover={!active ? { backgroundColor: 'rgba(78,205,196,0.06)' } : {}}
            whileTap={{ scale: 0.95 }}
            title={label}
            style={{
              flex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 5,
              padding: '6px 8px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontWeight: active ? 700 : 400,
              fontFamily: 'Inter, system-ui, sans-serif',
              letterSpacing: active ? '0.03em' : '0.01em',
              color: active ? 'var(--ac-cyan)' : 'var(--text-tertiary)',
              background: active ? 'rgba(78,205,196,0.13)' : 'transparent',
              boxShadow: active ? '0 0 12px rgba(78,205,196,0.12), inset 0 1px 0 rgba(255,255,255,0.05)' : 'none',
              transition: 'color 0.18s, background 0.18s, box-shadow 0.18s',
              position: 'relative',
            }} className="text-micro"
          >
            {/* Active indicator dot */}
            <AnimatePresence>
              {active && (
                <motion.span
                  layoutId="theme-active-dot"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 8,
                    border: '1px solid rgba(78,205,196,0.30)',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </AnimatePresence>
            <Icon size={12} style={{ flexShrink: 0 }} />
            <span>{label}</span>
          </motion.button>
        )
      })}
    </div>
  )
}

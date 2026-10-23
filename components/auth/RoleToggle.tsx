'use client'

import { motion } from 'framer-motion'
import { GraduationCap, Building2, ShieldCheck } from 'lucide-react'

export type AuthRole = 'student' | 'employer' | 'admin'

const OPTIONS: { value: AuthRole; label: string; Icon: typeof GraduationCap }[] = [
  { value: 'student', label: 'Student', Icon: GraduationCap },
  { value: 'employer', label: 'Employer', Icon: Building2 },
  { value: 'admin', label: 'Admin', Icon: ShieldCheck },
]

export default function RoleToggle({
  value,
  onChange,
}: {
  value: AuthRole
  onChange: (role: AuthRole) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Account type"
      style={{
        display: 'flex', position: 'relative', padding: 4, marginBottom: 24,
        background: '#f1f3f5', borderRadius: 14, border: '1px solid rgba(0,0,0,0.05)',
      }}
    >
      {OPTIONS.map(({ value: optionValue, label, Icon }) => {
        const active = value === optionValue
        return (
          <button
            key={optionValue}
            id={`role-toggle-${optionValue}`}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(optionValue)}
            style={{
              flex: 1, position: 'relative', zIndex: 1, border: 'none', background: 'none',
              padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontWeight: 700, fontSize: 13, fontFamily: 'Montserrat, system-ui, sans-serif',
              color: active ? '#1A365D' : '#8a949c', transition: 'color 0.2s',
            }}
          >
            {active && (
              <motion.span
                layoutId="role-toggle-pill"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                style={{
                  position: 'absolute', inset: 0, zIndex: -1, borderRadius: 10,
                  background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(26,54,93,0.08)',
                }}
              />
            )}
            <Icon size={15} />
            {label}
          </button>
        )
      })}
    </div>
  )
}

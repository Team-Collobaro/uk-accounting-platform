'use client'
import './BorderGlow.css'

interface BorderGlowProps {
  children: React.ReactNode
  className?: string
  color?: string
  duration?: string
  style?: React.CSSProperties
}

export default function BorderGlow({
  children,
  className = '',
  color = 'rgba(78, 205, 196, 0.8)',
  duration = '3s',
  style,
}: BorderGlowProps) {
  return (
    <div
      className={`border-glow-wrapper ${className}`}
      style={{
        '--border-glow-color': color,
        '--border-glow-duration': duration,
        ...style,
      } as React.CSSProperties}
    >
      <div className="border-glow-content">{children}</div>
    </div>
  )
}

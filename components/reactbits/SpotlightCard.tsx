'use client'
import { useRef } from 'react'
import './SpotlightCard.css'

interface SpotlightCardProps {
  children: React.ReactNode
  className?: string
  spotlightColor?: string
  style?: React.CSSProperties
}

export default function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(78,205,196,0.18)',
  style,
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return
    const rect = divRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    divRef.current.style.setProperty('--mouse-x', `${x}px`)
    divRef.current.style.setProperty('--mouse-y', `${y}px`)
    divRef.current.style.setProperty('--spotlight-color', spotlightColor)
  }

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      className={`card-spotlight ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}

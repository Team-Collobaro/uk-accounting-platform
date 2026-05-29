'use client'
import React from 'react'
import './StarBorder.css'

interface StarBorderProps {
  as?: React.ElementType
  className?: string
  color?: string
  speed?: string
  thickness?: number
  children: React.ReactNode
  style?: React.CSSProperties
  [key: string]: unknown
}

export default function StarBorder({
  as: Component = 'button',
  className = '',
  color = 'rgba(78,205,196,0.9)',
  speed = '6s',
  thickness = 1,
  children,
  style,
  ...rest
}: StarBorderProps) {
  return (
    <Component
      className={`star-border-container ${className}`}
      style={{ padding: `${thickness}px 0`, ...style }}
      {...rest}
    >
      <div
        className="star-border-gradient-bottom"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      />
      <div
        className="star-border-gradient-top"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      />
      <div className="star-border-inner">{children}</div>
    </Component>
  )
}

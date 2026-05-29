'use client'

import { useEffect, useRef } from 'react'

interface WatchSpinnerProps {
  size?: number
  className?: string
  style?: React.CSSProperties
}

export default function WatchSpinner({ size = 56, className = '', style }: WatchSpinnerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const s = size * dpr
    canvas.width = s
    canvas.height = s
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`

    const cx = s / 2
    const cy = s / 2

    const rings = [
      { r: cx * 0.78, width: dpr * 1.8, speed: 0.022, color: [78, 205, 196],  gap: 0.28, angle: 0 },
      { r: cx * 0.58, width: dpr * 1.5, speed: -0.034, color: [155, 111, 208], gap: 0.38, angle: Math.PI / 3 },
      { r: cx * 0.38, width: dpr * 1.2, speed: 0.052, color: [68, 138, 255],  gap: 0.48, angle: Math.PI },
    ]

    // Static tick marks on the outer bezel
    const drawTicks = () => {
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2 - Math.PI / 2
        const isMajor = i % 5 === 0
        const inner = cx * (isMajor ? 0.88 : 0.91)
        const outer = cx * 0.96
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner)
        ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer)
        ctx.strokeStyle = isMajor
          ? `rgba(78,205,196,0.7)`
          : `rgba(78,205,196,0.2)`
        ctx.lineWidth = isMajor ? dpr * 1.5 : dpr * 0.8
        ctx.stroke()
      }
    }

    let raf: number
    const draw = () => {
      ctx.clearRect(0, 0, s, s)

      // Outer bezel ring
      ctx.beginPath()
      ctx.arc(cx, cy, cx * 0.96, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(78,205,196,0.15)'
      ctx.lineWidth = dpr * 1
      ctx.stroke()

      drawTicks()

      // Spinning arcs
      for (const ring of rings) {
        ring.angle += ring.speed
        const start = ring.angle
        const end = ring.angle + Math.PI * 2 * (1 - ring.gap)

        // Glow pass
        ctx.save()
        ctx.shadowBlur = 10 * dpr
        ctx.shadowColor = `rgba(${ring.color.join(',')},0.7)`
        ctx.beginPath()
        ctx.arc(cx, cy, ring.r, start, end)
        ctx.strokeStyle = `rgba(${ring.color.join(',')},0.9)`
        ctx.lineWidth = ring.width
        ctx.lineCap = 'round'
        ctx.stroke()
        ctx.restore()

        // Leading dot
        const dotA = end
        const gx = cx + Math.cos(dotA) * ring.r
        const gy = cy + Math.sin(dotA) * ring.r
        ctx.save()
        ctx.shadowBlur = 14 * dpr
        ctx.shadowColor = `rgba(${ring.color.join(',')},1)`
        ctx.beginPath()
        ctx.arc(gx, gy, ring.width * 1.4, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${ring.color.join(',')},1)`
        ctx.fill()
        ctx.restore()
      }

      // Centre dot
      ctx.save()
      ctx.shadowBlur = 12 * dpr
      ctx.shadowColor = 'rgba(78,205,196,0.9)'
      ctx.beginPath()
      ctx.arc(cx, cy, dpr * 3, 0, Math.PI * 2)
      ctx.fillStyle = '#4ECDC4'
      ctx.fill()
      ctx.restore()

      raf = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(raf)
  }, [size])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={style}
    />
  )
}

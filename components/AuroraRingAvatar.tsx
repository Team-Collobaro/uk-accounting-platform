'use client'

import React, { useEffect, useRef } from 'react'

interface AuroraRingProps {
  audioAnalyser?: AnalyserNode | null
  size?: number
}

export const AuroraRingAvatar: React.FC<AuroraRingProps> = ({ audioAnalyser, size = 220 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const px = size * dpr
    canvas.width = px
    canvas.height = px
    canvas.style.width  = `${size}px`
    canvas.style.height = `${size}px`

    const cx = px / 2
    const cy = px / 2
    const baseRadius = px * 0.38

    const bufferLength = audioAnalyser ? audioAnalyser.frequencyBinCount : 64
    const dataArray = new Uint8Array(bufferLength)

    let rafId: number

    const render = () => {
      rafId = requestAnimationFrame(render)

      let vol = 0
      if (audioAnalyser) {
        audioAnalyser.getByteFrequencyData(dataArray)
        let total = 0
        for (let i = 0; i < bufferLength / 2; i++) total += dataArray[i]
        vol = total / (bufferLength / 2) / 255
      } else {
        vol = (Math.sin(Date.now() * 0.002) + 1) * 0.08
      }

      ctx.clearRect(0, 0, px, px)

      ctx.save()

      const gradient = ctx.createConicGradient(-Math.PI / 1.2, cx, cy)
      gradient.addColorStop(0.0, '#3a86ff')
      gradient.addColorStop(0.2, '#00f2fe')
      gradient.addColorStop(0.5, '#a18cd1')
      gradient.addColorStop(0.7, '#8a2be2')
      gradient.addColorStop(0.9, '#ffffff')
      gradient.addColorStop(1.0, '#3a86ff')

      const r = baseRadius + vol * px * 0.06

      // outer soft bloom layer
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.strokeStyle = gradient
      ctx.lineWidth   = (18 + vol * 10) * dpr
      ctx.shadowColor = '#00f2fe'
      ctx.shadowBlur  = 40 * dpr
      ctx.globalAlpha = 0.4
      ctx.stroke()

      // inner sharp core ring
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.lineWidth   = (6 + vol * 4) * dpr
      ctx.shadowColor = '#ffffff'
      ctx.shadowBlur  = 15 * dpr
      ctx.globalAlpha = 0.95
      ctx.stroke()

      ctx.restore()
    }

    render()
    return () => cancelAnimationFrame(rafId)
  }, [audioAnalyser, size])

  return (
    <canvas
      ref={canvasRef}
      style={{ borderRadius: '50%', display: 'block' }}
    />
  )
}

export default AuroraRingAvatar

'use client'

import React, { useEffect, useRef } from 'react'
import { BANDS, type HeardSound } from '@/lib/lipSync'

export type VoiceMode = 'idle' | 'listening' | 'thinking' | 'speaking'

interface VoiceBarsProps {
  mode: VoiceMode
  /** The sound being heard right now (which clip, and how far into it), or null when it cannot be read. */
  getSound?: () => HeardSound | null
  /** The voice's loudness right now, 0 to 1: used while speaking when the sound cannot be read. */
  getLevel?: () => number
  height?: number
}

const LABEL: Record<VoiceMode, string> = {
  idle: 'Tutor ready', listening: 'Tutor listening', thinking: 'Tutor thinking', speaking: 'Tutor speaking',
}

// The voice as a row of bars, mirrored about the middle: the lowest pitch range in the middle, higher
// ones towards each end, each bar as tall as its range is strong at the moment heard
const BARS = BANDS * 2 - 1
const MIDDLE = BANDS - 1
// Bar colours from the middle out: cyan, blue, violet
const COLORS: Array<[number, number, number]> = [[34, 211, 238], [59, 130, 246], [168, 85, 247]]

const colorAt = (k: number) => {
  const x = Math.min(1, Math.max(0, k)) * (COLORS.length - 1)
  const i = Math.min(COLORS.length - 2, Math.floor(x))
  const f = x - i
  return COLORS[i].map((c, j) => Math.round(c + (COLORS[i + 1][j] - c) * f)) as [number, number, number]
}

export default function VoiceBars({ mode, getSound, getLevel, height = 190 }: VoiceBarsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const modeRef = useRef<VoiceMode>(mode)
  const soundRef = useRef<(() => HeardSound | null) | undefined>(getSound)
  const levelRef = useRef<(() => number) | undefined>(getLevel)
  modeRef.current = mode
  soundRef.current = getSound
  levelRef.current = getLevel

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    let width = 0
    let dpr = 1
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = canvas.clientWidth || 300
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const startedAt = performance.now()
    const bands = new Float32Array(BANDS)
    const shown = new Float32Array(BARS)
    let last = startedAt
    let raf = 0

    const frame = () => {
      raf = requestAnimationFrame(frame)
      const now = performance.now()
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const t = reduceMotion ? 0 : (now - startedAt) / 1000
      const m = modeRef.current

      // While speaking: each pitch range of the sound being heard, or, where the sound cannot be read,
      // the voice's loudness spread over the bars
      let heard: HeardSound | null = null
      let loud = 0
      if (m === 'speaking') {
        try { heard = soundRef.current?.() ?? null } catch { heard = null }
        if (heard) heard.track.bandsAt(heard.seconds, bands)
        else {
          try { loud = Math.min(1, Math.max(0, levelRef.current?.() ?? 0)) } catch { loud = 0 }
        }
      }

      for (let i = 0; i < BARS; i++) {
        const k = Math.abs(i - MIDDLE) // pitch range: 0 in the middle
        const edge = k / MIDDLE
        let target: number
        if (m === 'speaking') {
          target = heard
            ? Math.pow(bands[k], 1.8) * (1 - 0.25 * edge) // only the strongest ranges reach the top
            : loud * (0.55 + 0.45 * (1 - edge)) * (0.7 + 0.3 * Math.sin(t * 13 + k * 1.7))
        } else if (m === 'listening') {
          target = 0.16 + 0.12 * Math.sin(t * 2.4 - k * 0.45)
        } else if (m === 'thinking') {
          const at = Math.sin(t * 2.2) * MIDDLE
          target = 0.08 + 0.45 * Math.exp(-(((i - MIDDLE - at) / 2.4) ** 2))
        } else {
          target = 0.04
        }
        // Bars jump up at once and fall back a little slower, like a level meter
        const tau = target > shown[i] ? 0.025 : 0.09
        shown[i] += (target - shown[i]) * (1 - Math.exp(-dt / tau))
      }

      const w = width
      const h = height
      const mid = h / 2
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const span = Math.min(w * 0.86, BARS * 14)
      const slot = span / BARS
      const barW = Math.max(3, slot * 0.58)
      const x0 = (w - span) / 2
      const tallest = h * 0.78
      for (let i = 0; i < BARS; i++) {
        const k = Math.abs(i - MIDDLE) / MIDDLE
        const [r, g, b] = colorAt(k)
        const barH = Math.max(barW, shown[i] * tallest)
        const x = x0 + i * slot + (slot - barW) / 2
        ctx.shadowColor = `rgba(${r},${g},${b},0.75)`
        ctx.shadowBlur = 6 + 12 * shown[i]
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.beginPath()
        ctx.roundRect(x, mid - barH / 2, barW, barH, barW / 2)
        ctx.fill()
      }
      ctx.shadowBlur = 0
    }
    frame()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [height])

  return (
    <div style={{ position: 'relative', width: '100%', height, borderRadius: 14, overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 50%, #0d1530 0%, #05070d 75%)' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height }} aria-hidden="true" />
      <span role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
        {LABEL[mode]}
      </span>
    </div>
  )
}

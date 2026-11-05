'use client'

import React, { useEffect, useRef } from 'react'
import { BANDS, type HeardSound } from '@/lib/lipSync'

export type VoiceMode = 'idle' | 'listening' | 'thinking' | 'speaking'

interface VoiceRibbonProps {
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

// The voice as soft ribbons of light, mirrored above and below a thin line: magenta on the left
// shading to blue on the right, swelling out of the line in the middle and tapering away at the ends.
// Their outline is the sound being heard: its low pitches in the middle, higher ones further out.
const POINTS = 160
// Each ribbon: how its hills ripple along the line, how fast they roll, and how much of the voice it takes
const RIBBONS = [
  { freq: 7.0, speed: 1.1, phase: 0.0, gain: 1.0 },
  { freq: 9.5, speed: -1.4, phase: 1.9, gain: 0.85 },
  { freq: 5.5, speed: 0.8, phase: 3.7, gain: 0.7 },
  { freq: 12.0, speed: 1.9, phase: 5.1, gain: 0.55 },
]
const PINK = [255, 64, 200] as const
const VIOLET = [150, 70, 255] as const
const BLUE = [70, 90, 255] as const

export default function VoiceRibbon({ mode, getSound, getLevel, height = 190 }: VoiceRibbonProps) {
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
    const shape = new Float32Array(BANDS) // how far the ribbons swell at each pitch range, smoothed
    let clock = 0
    let last = startedAt
    let raf = 0

    const frame = () => {
      raf = requestAnimationFrame(frame)
      const now = performance.now()
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const t = (now - startedAt) / 1000
      const m = modeRef.current

      // While speaking: the pitch ranges of the sound being heard, or, where the sound cannot be read,
      // the voice's loudness, fullest in the middle
      let heard: HeardSound | null = null
      let loud = 0
      if (m === 'speaking') {
        try { heard = soundRef.current?.() ?? null } catch { heard = null }
        if (heard) heard.track.bandsAt(heard.seconds, bands)
        else {
          try { loud = Math.min(1, Math.max(0, levelRef.current?.() ?? 0)) } catch { loud = 0 }
        }
      }
      for (let k = 0; k < BANDS; k++) {
        const out = k / (BANDS - 1)
        const target = m === 'speaking'
          ? (heard ? Math.pow(bands[k], 1.15) : loud * (1 - 0.4 * out))
          : m === 'listening' ? 0.32 + 0.1 * Math.sin(t * 2.3 - k * 0.4)
          : m === 'thinking' ? 0.18 + 0.35 * Math.exp(-(((out - (0.5 + 0.5 * Math.sin(t * 2))) / 0.2) ** 2))
          : 0.05
        // Swells at once with each sound and settles a little slower
        const tau = target > shape[k] ? 0.03 : 0.1
        shape[k] += (target - shape[k]) * (1 - Math.exp(-dt / tau))
      }
      let energy = 0
      for (let k = 0; k < BANDS; k++) energy = Math.max(energy, shape[k])
      if (!reduceMotion) clock += dt * (0.6 + 1.6 * energy)

      const w = width
      const h = height
      const mid = h / 2
      const reach = h * 0.47
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      // Magenta to violet to blue, left to right, fading out at both ends
      const across = (alpha: number) => {
        const g = ctx.createLinearGradient(0, 0, w, 0)
        g.addColorStop(0, `rgba(${PINK.join(',')},0)`)
        g.addColorStop(0.18, `rgba(${PINK.join(',')},${alpha})`)
        g.addColorStop(0.5, `rgba(${VIOLET.join(',')},${alpha})`)
        g.addColorStop(0.82, `rgba(${BLUE.join(',')},${alpha})`)
        g.addColorStop(1, `rgba(${BLUE.join(',')},0)`)
        return g
      }

      // The swell along the line, from the pitch ranges (low in the middle), tapering to nothing at the ends
      const swell = new Float32Array(POINTS + 1)
      for (let i = 0; i <= POINTS; i++) {
        const x = -1 + (2 * i) / POINTS
        const at = Math.min(1, Math.abs(x) / 0.7) * (BANDS - 1)
        const k = Math.floor(at)
        const f = at - k
        const s = shape[k] + ((shape[Math.min(BANDS - 1, k + 1)] ?? shape[k]) - shape[k]) * f
        // Full through the middle, narrowing to the thin line well before the ends
        const taper = Math.exp(-x * x * 2.4) * Math.max(0, 1 - Math.pow(Math.abs(x) / 0.92, 4))
        swell[i] = Math.min(1.1, 0.04 + 1.15 * s) * taper
      }

      ctx.globalCompositeOperation = 'lighter'
      RIBBONS.forEach((ribbon, r) => {
        const top: number[] = []
        for (let i = 0; i <= POINTS; i++) {
          const x = -1 + (2 * i) / POINTS
          // Each ribbon's own rolling hills, so the layers cross and part as in the picture
          const hills = 0.55 + 0.45 * Math.sin(x * ribbon.freq + clock * ribbon.speed + ribbon.phase)
          top.push(swell[i] * hills * ribbon.gain * reach)
        }
        // Above the line, then its reflection below, a little smaller
        ctx.beginPath()
        ctx.moveTo(0, mid)
        top.forEach((a, i) => ctx.lineTo((i / POINTS) * w, mid - a))
        for (let i = POINTS; i >= 0; i--) ctx.lineTo((i / POINTS) * w, mid + top[i] * 0.82)
        ctx.closePath()
        ctx.fillStyle = across(0.16 + 0.04 * (RIBBONS.length - r))
        ctx.fill()
        // A bright edge on each ribbon, above and below
        ctx.lineWidth = 1.3
        ctx.strokeStyle = across(0.75)
        ctx.shadowColor = r % 2 ? `rgba(${BLUE.join(',')},0.8)` : `rgba(${PINK.join(',')},0.8)`
        ctx.shadowBlur = 8
        ctx.beginPath()
        top.forEach((a, i) => (i ? ctx.lineTo((i / POINTS) * w, mid - a) : ctx.moveTo(0, mid - a)))
        ctx.stroke()
        ctx.beginPath()
        top.forEach((a, i) => (i ? ctx.lineTo((i / POINTS) * w, mid + a * 0.82) : ctx.moveTo(0, mid + a * 0.82)))
        ctx.stroke()
        ctx.shadowBlur = 0
      })
      ctx.globalCompositeOperation = 'source-over'

      // The thin line running the whole width
      ctx.fillStyle = across(0.9)
      ctx.fillRect(w * 0.03, mid - 0.6, w * 0.94, 1.2)
    }
    frame()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [height])

  return (
    <div style={{ position: 'relative', width: '100%', height, borderRadius: 14, overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 50%, #10195a 0%, #070b2c 70%)' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height }} aria-hidden="true" />
      <span role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
        {LABEL[mode]}
      </span>
    </div>
  )
}

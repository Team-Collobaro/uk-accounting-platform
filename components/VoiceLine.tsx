'use client'

import React, { useEffect, useRef } from 'react'

export type VoiceMode = 'idle' | 'listening' | 'thinking' | 'speaking'

interface VoiceLineProps {
  mode: VoiceMode
  /**
   * The sound being heard right now: fills `out` with its waveform (about ±1 at its loudest) and
   * returns true, or returns false when the sound cannot be read (the browser's own voice).
   */
  getWave?: (out: Float32Array) => boolean
  /** The voice's loudness right now, 0 to 1: used while speaking when there is no waveform. */
  getLevel?: () => number
  height?: number
}

const LABEL: Record<VoiceMode, string> = {
  idle: 'Tutor ready', listening: 'Tutor listening', thinking: 'Tutor thinking', speaking: 'Tutor speaking',
}

// A glowing green trace, like a sound wave on a scope
const GREEN = [70, 235, 175] as const
const POINTS = 400 // along the width

export default function VoiceLine({ mode, getWave, getLevel, height = 190 }: VoiceLineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const modeRef = useRef<VoiceMode>(mode)
  const waveRef = useRef<((out: Float32Array) => boolean) | undefined>(getWave)
  const levelRef = useRef<(() => number) | undefined>(getLevel)
  modeRef.current = mode
  waveRef.current = getWave
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
    const sound = new Float32Array(POINTS + 1)
    let energy = 0
    let glow = 0
    let phase = 0
    let last = startedAt
    let raf = 0

    const frame = () => {
      raf = requestAnimationFrame(frame)
      const now = performance.now()
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const t = (now - startedAt) / 1000
      const ease = (current: number, target: number, tau: number) => current + (target - current) * (1 - Math.exp(-dt / tau))
      const m = modeRef.current

      // While speaking, the trace is the sound itself where it can be read
      let heard = false
      if (m === 'speaking') {
        try { heard = waveRef.current?.(sound) ?? false } catch { heard = false }
      }
      // Otherwise a drawn wave, as tall as the voice is loud right now (no lag), or gentle when not speaking
      let raw = 0
      if (m === 'speaking' && !heard) {
        try { raw = Math.min(1, Math.max(0, levelRef.current?.() ?? 0)) } catch { raw = 0 }
      }
      const target = m === 'speaking' ? raw
        : m === 'listening' ? 0.28 + 0.1 * Math.sin(t * 2.4)
        : m === 'thinking' ? 0.16 + 0.06 * Math.sin(t * 6)
        : 0.025
      energy = ease(energy, target, m === 'speaking' ? 0.025 : 0.25)
      phase += reduceMotion ? 0 : dt * (m === 'thinking' ? 14 : m === 'speaking' ? 9 : 4)

      const w = width
      const h = height
      const mid = h / 2
      const ys = new Float32Array(POINTS + 1)
      let loud = 0
      for (let i = 0; i <= POINTS; i++) {
        const x = -1 + (2 * i) / POINTS
        // Tallest in the middle, flat at both ends
        const taper = Math.pow(Math.max(0, 1 - Math.abs(x) * 1.1), 1.3)
        let v: number
        if (heard) {
          v = sound[i] * 1.15
        } else {
          const wave = 0.55 * Math.sin(x * 104 + phase)
            + 0.3 * Math.sin(x * 157 - phase * 1.3 + 1.1)
            + 0.25 * Math.sin(x * 61 + phase * 0.7 + 2.3)
          const lumpy = 0.7 + 0.3 * Math.sin(x * 13 + phase * 0.35) * Math.sin(x * 5.3 - 1.3)
          v = wave * lumpy * (0.04 + energy)
        }
        v = Math.max(-1.6, Math.min(1.6, v)) * taper
        loud = Math.max(loud, Math.abs(v))
        ys[i] = mid - v * h * 0.36
      }
      glow = ease(glow, Math.min(1, loud), 0.08)

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      // The soft green light the trace casts, brighter as the voice grows
      const light = ctx.createRadialGradient(w / 2, mid, 0, w / 2, mid, Math.max(w, h) * 0.6)
      light.addColorStop(0, `rgba(${GREEN[0]},${GREEN[1]},${GREEN[2]},${0.1 + 0.16 * glow})`)
      light.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = light
      ctx.fillRect(0, 0, w, h)

      ctx.beginPath()
      for (let i = 0; i <= POINTS; i++) {
        const px = (i / POINTS) * w
        if (i === 0) ctx.moveTo(px, ys[i])
        else ctx.lineTo(px, ys[i])
      }
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      // Drawn wide and faint, then narrower and brighter, for a neon glow
      for (const [lineWidth, alpha, blur] of [[7, 0.12, 16], [3.2, 0.4, 8], [1.4, 1, 3]] as const) {
        ctx.lineWidth = lineWidth
        ctx.strokeStyle = lineWidth < 2 ? 'rgb(190,255,228)' : `rgba(${GREEN[0]},${GREEN[1]},${GREEN[2]},${alpha})`
        ctx.shadowColor = `rgba(${GREEN[0]},${GREEN[1]},${GREEN[2]},0.9)`
        ctx.shadowBlur = blur
        ctx.stroke()
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
    <div style={{ position: 'relative', width: '100%', height, borderRadius: 14, overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 50%, #0b2a22 0%, #050c0a 70%)' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height }} aria-hidden="true" />
      <span role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
        {LABEL[mode]}
      </span>
    </div>
  )
}

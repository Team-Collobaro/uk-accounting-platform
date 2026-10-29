'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Captions, CaptionsOff, FileText, RotateCcw,
  Building2, Building, Store, Factory, Briefcase, Users, User, UserCheck, UserX, UserPlus, UserMinus,
  PiggyBank, Wallet, Banknote, Coins, HandCoins, PoundSterling, Percent, Calculator, Receipt, CreditCard,
  Calendar, CalendarClock, CalendarCheck, Clock, Timer, Hourglass, FileCheck, FileWarning,
  ClipboardCheck, ClipboardList, Scale, Gavel, Landmark, ShieldCheck, ShieldAlert, AlertTriangle, Ban,
  TrendingUp, TrendingDown, BarChart3, PieChart, LineChart, ArrowRightLeft, RefreshCw,
  CheckCircle2, XCircle, HelpCircle, Lightbulb, BookOpen, GraduationCap, Target, Search, Lock, Key,
  Database, Laptop, Globe, Mail, Send, Handshake, Truck, Package, ShoppingCart, Home, Car, Layers,
  Split, Stamp, Flag, Network, Workflow, Sparkles,
  type LucideIcon,
} from 'lucide-react'
import type { ExplainerScene, ExplainerKind } from '@/lib/explainer'
import { startLocalTts, localSpeak, normaliseForSpeech, pickBrowserVoice, whenAudible } from '@/lib/localTts'
import { EXPLAINER_EVENTS, setPresenterMouthSource, type ExplainerStateDetail, type ExplainerControlDetail, type ExplainerIdDetail } from '@/lib/tutorPresenter'
import { AudioLipTrack, MOUTH_REST, TextLipSync } from '@/lib/lipSync'

// Must match ICONS in scripts/build-explainers.mjs
const ICONS: Record<string, LucideIcon> = {
  Building2, Building, Store, Factory, Briefcase, Users, User, UserCheck, UserX, UserPlus, UserMinus,
  PiggyBank, Wallet, Banknote, Coins, HandCoins, PoundSterling, Percent, Calculator, Receipt, CreditCard,
  Calendar, CalendarClock, CalendarCheck, Clock, Timer, Hourglass, FileText, FileCheck, FileWarning,
  ClipboardCheck, ClipboardList, Scale, Gavel, Landmark, ShieldCheck, ShieldAlert, AlertTriangle, Ban,
  TrendingUp, TrendingDown, BarChart3, PieChart, LineChart, ArrowRightLeft, RefreshCw, RotateCcw,
  CheckCircle2, XCircle, HelpCircle, Lightbulb, BookOpen, GraduationCap, Target, Search, Lock, Key,
  Database, Laptop, Globe, Mail, Send, Handshake, Truck, Package, ShoppingCart, Home, Car, Layers,
  Split, Stamp, Flag, Network, Workflow, Sparkles,
}
const Icon = ({ name, size, color }: { name: string; size: string; color?: string }) => {
  const C = ICONS[name] ?? Sparkles
  return <C style={{ width: size, height: size, color, flexShrink: 0 }} strokeWidth={1.8} />
}

const ACCENT: Record<ExplainerKind, string> = {
  title: '#35e0ff', stats: '#e8b84b', steps: '#35e0ff', compare: '#a58bff', timeline: '#52d98b',
  cards: '#35e0ff', example: '#e8b84b', warning: '#ff6b5b', checklist: '#52d98b',
}

const WORDS_PER_SECOND = 2.6
const HOLD_BETWEEN_SCENES_MS = 700

// Font size that scales with the stage width but never gets unreadably small
const fs = (cqw: number, min: number) => `max(${min}px, ${cqw}cqw)`
const MONO = '"JetBrains Mono", ui-monospace, monospace'
const SANS = '"Montserrat", system-ui, sans-serif'

const readSetting = (key: string) => {
  try { return localStorage.getItem(key) } catch { return null }
}

interface ModuleExplainerProps {
  /** The tutor addresses this video by id: "m23" for the module intro, "m23/s02" for a section */
  videoId: string
  moduleNumber: number | string
  moduleTitle: string
  scenes: ExplainerScene[]
  hookHtml?: string
  /** Over the title, e.g. "SECTION 23.2" (default "MODULE 23") */
  kicker?: string
  /** Top-left tag, e.g. "23.2" (default "M23") */
  badge?: string
}

type NarrationMode = 'audio' | 'speech' | 'timer' | null

export default function ModuleExplainer({ videoId, moduleNumber, moduleTitle, scenes, hookHtml, kicker = `MODULE ${moduleNumber}`, badge = `M${moduleNumber}` }: ModuleExplainerProps) {
  const reduceMotion = useReducedMotion() ?? false
  const [sceneIdx, setSceneIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false)
  const [ended, setEnded] = useState(false)
  const [captions, setCaptions] = useState(true)
  const [muted, setMuted] = useState(false)
  const [showText, setShowText] = useState(false)
  const [compact, setCompact] = useState(false)

  const stageRef = useRef<HTMLDivElement>(null)
  const runRef = useRef(0)
  const sceneRef = useRef(0)
  const progressRef = useRef(0)
  const playingRef = useRef(false)
  const mutedRef = useRef(false)
  const speedRef = useRef(1)
  const modeRef = useRef<NarrationMode>(null)
  const nextRef = useRef<() => void>(() => {})
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef(0)
  const holdRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const audioCache = useRef(new Map<number, Promise<string | null>>())
  // Narration mouth shapes for the tutor's lips: each clip analysed once, before it first plays
  const trackCache = useRef(new Map<number, Promise<AudioLipTrack | null>>())
  const trackRef = useRef<AudioLipTrack | null>(null)
  const textSyncRef = useRef<TextLipSync | null>(null)
  const playRef = useRef<() => void>(() => {})
  const pauseRef = useRef<() => void>(() => {})

  const totalSeconds = useMemo(
    () => Math.round(scenes.reduce((s, sc) => s + sc.narration.split(/\s+/).length / WORDS_PER_SECOND, 0) + scenes.length * 0.7),
    [scenes],
  )

  // True only while the narration is audible; the tutor's mouth stays still while a clip is still loading
  const [voiced, setVoiced] = useState(false)
  const voicedRef = useRef(false)
  const setVoice = useCallback((v: boolean) => {
    voicedRef.current = v
    setVoiced(v)
  }, [])

  const setP = useCallback((p: number) => {
    progressRef.current = p
    setProgress(p)
  }, [])

  // Layout switches to a taller, stacked stage on narrow screens
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setCompact(el.clientWidth < 560))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Narration audio from the on-device tutor voice; null means use the fallback
  const fetchAudio = useCallback((i: number): Promise<string | null> => {
    let p = audioCache.current.get(i)
    if (!p) {
      startLocalTts()
      p = localSpeak(normaliseForSpeech(scenes[i].narration)).then((url) => {
        if (!url) audioCache.current.delete(i)
        return url
      })
      audioCache.current.set(i, p)
    }
    return p
  }, [scenes])

  // Warm up the first clip while the tutor is still introducing the video, so it starts without a pause
  useEffect(() => {
    const t = setTimeout(() => { void fetchAudio(0) }, 1500)
    return () => clearTimeout(t)
  }, [fetchAudio])

  // Stops whatever is narrating and invalidates its callbacks. Leaves speechSynthesis alone
  // unless this player owns it, so the AI tutor's own speech is never cut off from here.
  const haltNarration = useCallback(() => {
    setVoice(false)
    runRef.current += 1
    clearTimeout(holdRef.current)
    cancelAnimationFrame(rafRef.current)
    if (audioRef.current) {
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.ontimeupdate = null
      audioRef.current.pause()
      audioRef.current = null
    }
    if (modeRef.current === 'speech' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    modeRef.current = null
  }, [setVoice])

  const startTimer = useCallback((scene: ExplainerScene, run: number, from = 0) => {
    modeRef.current = 'timer'
    const words = scene.narration.split(/\s+/).length
    const duration = Math.max(3500, (words / WORDS_PER_SECOND) * 1000) / speedRef.current
    const t0 = performance.now() - from * duration
    const tick = () => {
      if (run !== runRef.current) return
      const p = (performance.now() - t0) / duration
      if (p >= 1) { nextRef.current(); return }
      if (Math.abs(p - progressRef.current) > 0.008) setP(p)
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()
  }, [setP])

  const speakBrowser = useCallback((scene: ExplainerScene, run: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) { startTimer(scene, run); return }
    const u = new SpeechSynthesisUtterance(scene.narration)
    u.lang = 'en-GB'
    u.rate = 0.95 * speedRef.current
    const gb = pickBrowserVoice()
    if (gb) u.voice = gb
    const sync = new TextLipSync(scene.narration, u.rate)
    textSyncRef.current = sync
    whenAudible(u, () => { if (run === runRef.current && playingRef.current) { sync.start(); setVoice(true) } })
    u.onboundary = (e) => {
      if (run !== runRef.current) return
      sync.boundary(e.charIndex, e.name)
      setP(e.charIndex / scene.narration.length)
    }
    u.onend = () => { if (run === runRef.current) { sync.finish(); nextRef.current() } }
    u.onerror = (e) => {
      if (run !== runRef.current) return
      // Cancelled by someone else (e.g. the AI tutor started talking): stop here, resume later
      if (e.error === 'interrupted' || e.error === 'canceled') {
        modeRef.current = null
        playingRef.current = false
        setPlaying(false)
        return
      }
      nextRef.current()
    }
    modeRef.current = 'speech'
    window.speechSynthesis.speak(u)
  }, [setP, setVoice, startTimer])

  const playScene = useCallback(async (i: number) => {
    haltNarration()
    const run = runRef.current
    const scene = scenes[i]
    sceneRef.current = i
    setSceneIdx(i)
    setP(0)
    setEnded(false)
    playingRef.current = true
    setPlaying(true)

    nextRef.current = () => {
      if (run !== runRef.current) return
      setP(1)
      modeRef.current = null
      if (i + 1 >= scenes.length) {
        playingRef.current = false
        setPlaying(false)
        setEnded(true)
        return
      }
      holdRef.current = setTimeout(() => {
        if (run === runRef.current && playingRef.current) void playScene(i + 1)
      }, HOLD_BETWEEN_SCENES_MS)
    }

    if (mutedRef.current) { startTimer(scene, run); return }
    if (i + 1 < scenes.length) void fetchAudio(i + 1) // prefetch so the next scene starts instantly

    const url = await fetchAudio(i)
    if (run !== runRef.current) return
    if (!url) { speakBrowser(scene, run); return }
    let track = trackCache.current.get(i)
    if (!track) { track = AudioLipTrack.load(url); trackCache.current.set(i, track) }
    trackRef.current = await track
    if (run !== runRef.current) return

    const el = new Audio(url)
    el.playbackRate = speedRef.current
    el.muted = mutedRef.current
    audioRef.current = el
    modeRef.current = 'audio'
    textSyncRef.current = new TextLipSync(scene.narration)
    el.onplaying = () => { if (run === runRef.current) setVoice(true) } // the voice is audible: the mouth may move
    el.ontimeupdate = () => { if (run === runRef.current && el.duration) setP(el.currentTime / el.duration) }
    el.onended = () => nextRef.current()
    el.onerror = () => { if (run === runRef.current) speakBrowser(scene, run) }
    el.play().catch(() => { if (run === runRef.current) speakBrowser(scene, run) })
  }, [scenes, haltNarration, fetchAudio, speakBrowser, startTimer, setP, setVoice])

  const play = useCallback(() => {
    // The AI tutor stops talking, and any other video on the page pauses
    window.dispatchEvent(new CustomEvent<ExplainerIdDetail>(EXPLAINER_EVENTS.play, { detail: { id: videoId } }))
    const sp = Number(readSetting('tutor-voice-speed'))
    speedRef.current = sp >= 0.5 && sp <= 2 ? sp : 1
    setStarted(true)

    const i = sceneRef.current
    if (ended || !started) { void playScene(ended ? 0 : i); return }
    if (progressRef.current >= 1) { void playScene(Math.min(i + 1, scenes.length - 1)); return }

    playingRef.current = true
    setPlaying(true)
    const mode = modeRef.current
    if (mode === 'audio' && audioRef.current) audioRef.current.play().catch(() => void playScene(i))
    else if (mode === 'speech') { window.speechSynthesis.resume(); setVoice(true) }
    else if (mode === 'timer') startTimer(scenes[i], runRef.current, progressRef.current)
    else void playScene(i)
  }, [videoId, ended, started, scenes, playScene, startTimer, setVoice])

  const pause = useCallback(() => {
    playingRef.current = false
    setPlaying(false)
    clearTimeout(holdRef.current)
    setVoice(false)
    const mode = modeRef.current
    if (mode === 'audio') audioRef.current?.pause()
    else if (mode === 'speech') window.speechSynthesis.pause()
    else if (mode === 'timer') cancelAnimationFrame(rafRef.current)
  }, [setVoice])

  const goTo = useCallback((i: number) => {
    const target = Math.max(0, Math.min(scenes.length - 1, i))
    if (playingRef.current) { void playScene(target); return }
    haltNarration()
    sceneRef.current = target
    setSceneIdx(target)
    setP(0)
    setEnded(false)
  }, [scenes.length, playScene, haltNarration, setP])

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current
    mutedRef.current = next
    setMuted(next)
    if (audioRef.current) audioRef.current.muted = next // keeps timing; subtitles stay in sync
    if (next && modeRef.current === 'speech' && playingRef.current) {
      const from = progressRef.current
      haltNarration()
      startTimer(scenes[sceneRef.current], runRef.current, from)
    }
  }, [haltNarration, startTimer, scenes])

  // The AI tutor started talking: stop narrating without touching its speech
  useEffect(() => {
    const onTutor = () => {
      if (!playingRef.current) return
      if (modeRef.current === 'speech') {
        // The shared speech engine now belongs to the tutor; restart this scene on resume
        modeRef.current = null
        haltNarration()
        playingRef.current = false
        setPlaying(false)
      } else {
        pause()
      }
    }
    window.addEventListener(EXPLAINER_EVENTS.tutorSpeaking, onTutor)
    return () => window.removeEventListener(EXPLAINER_EVENTS.tutorSpeaking, onTutor)
  }, [pause, haltNarration])

  playRef.current = play
  pauseRef.current = pause

  // The AI tutor presents this video: it starts it, and its play/pause buttons control it
  useEffect(() => {
    const onPresent = (e: Event) => {
      if ((e as CustomEvent<ExplainerIdDetail>).detail?.id !== videoId) return
      stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (!playingRef.current) playRef.current()
    }
    const onControl = (e: Event) => {
      const { id, action } = (e as CustomEvent<ExplainerControlDetail>).detail ?? {}
      if (id && id !== videoId) return
      if (action === 'play' && !playingRef.current) playRef.current()
      if (action === 'pause' && playingRef.current) pauseRef.current()
    }
    // Only one video narrates at a time
    const onOtherPlay = (e: Event) => {
      if ((e as CustomEvent<ExplainerIdDetail>).detail?.id !== videoId && playingRef.current) pauseRef.current()
    }
    window.addEventListener(EXPLAINER_EVENTS.present, onPresent)
    window.addEventListener(EXPLAINER_EVENTS.control, onControl)
    window.addEventListener(EXPLAINER_EVENTS.play, onOtherPlay)
    return () => {
      window.removeEventListener(EXPLAINER_EVENTS.present, onPresent)
      window.removeEventListener(EXPLAINER_EVENTS.control, onControl)
      window.removeEventListener(EXPLAINER_EVENTS.play, onOtherPlay)
    }
  }, [videoId])

  // Tell the tutor what the video is doing, so its avatar speaks along with the narration
  useEffect(() => {
    if (!started) return
    const detail: ExplainerStateDetail = {
      id: videoId,
      state: ended ? 'ended' : playing ? 'playing' : 'paused',
      voiced,
      scene: sceneIdx,
      total: scenes.length,
      heading: scenes[sceneIdx].heading,
    }
    window.dispatchEvent(new CustomEvent(EXPLAINER_EVENTS.state, { detail }))
  }, [videoId, started, playing, ended, voiced, sceneIdx, scenes])

  useEffect(() => {
    setPresenterMouthSource(videoId, () => {
      // Silent while paused, while a clip loads, and in the short gap between scenes
      if (!playingRef.current || !voicedRef.current || progressRef.current >= 1) return MOUTH_REST
      const sync = textSyncRef.current
      if (modeRef.current === 'audio') {
        const el = audioRef.current
        if (el && trackRef.current) return trackRef.current.shapeAt(el.currentTime)
        return sync && el?.duration ? sync.shapeAt(el.currentTime / el.duration) : MOUTH_REST
      }
      return sync ? sync.shape() : MOUTH_REST
    })
    return () => setPresenterMouthSource(videoId, null)
  }, [videoId])

  // Clean up audio and object URLs
  useEffect(() => {
    const cache = audioCache.current
    return () => {
      haltNarration()
      cache.forEach((p) => p.then((u) => { if (u) URL.revokeObjectURL(u) }))
      cache.clear()
      window.dispatchEvent(new CustomEvent(EXPLAINER_EVENTS.state, {
        detail: { id: videoId, state: 'stopped', scene: 0, total: 0, heading: '' } satisfies ExplainerStateDetail,
      }))
    }
  }, [videoId, haltNarration])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); if (playing) pause(); else play() }
    else if (e.key === 'ArrowRight') { e.preventDefault(); goTo(sceneIdx + 1) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(sceneIdx - 1) }
    else if (e.key === 'c') setCaptions((c) => !c)
    else if (e.key === 'm') toggleMute()
  }

  const scene = scenes[sceneIdx]
  const accent = ACCENT[scene.kind]
  // Items appear as the narrator reaches them; a paused, untouched scene shows everything
  const reveal = started && (playing || progress > 0) ? progress : 1

  return (
    <div style={{ margin: '16px 0 28px' }}>
      <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(53,224,255,0.22)', boxShadow: '0 18px 45px rgba(0,0,0,0.28)', background: '#060b18' }}>
        {/* Stage */}
        <div
          ref={stageRef}
          tabIndex={0}
          role="region"
          aria-label={`Video explainer: ${moduleTitle}. Space to play or pause, arrow keys to change scene.`}
          onKeyDown={onKeyDown}
          onClick={() => { if (started && !ended) { if (playing) pause(); else play() } }}
          style={{
            position: 'relative', width: '100%', aspectRatio: compact ? '4 / 5' : '16 / 9', containerType: 'inline-size',
            overflow: 'hidden', cursor: started && !ended ? 'pointer' : 'default', outline: 'none',
            background: 'radial-gradient(ellipse at 50% 40%, #0f1e3d 0%, #060b18 70%)', color: '#e8f0fc',
          }}
        >
          <Backdrop accent={accent} reduceMotion={reduceMotion} />

          {/* HUD */}
          <div style={{ position: 'absolute', top: '3.5%', left: '3.5%', right: '3.5%', display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: fs(1.25, 9), letterSpacing: '0.16em', color: 'rgba(232,240,252,0.55)', pointerEvents: 'none', zIndex: 2 }}>
            <span>{badge} · EXPLAINER</span>
            <span>{String(sceneIdx + 1).padStart(2, '0')} / {String(scenes.length).padStart(2, '0')}</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={sceneIdx}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12, filter: 'blur(4px)' }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', zIndex: 1,
                // Leave room at the bottom for the subtitles, or for the play button on the poster
                padding: compact ? (started && !ended ? '13% 6% 26%' : '10% 6% 34%') : (started && !ended ? '9% 7% 17%' : '6% 7% 25%'),
                transition: 'padding 0.4s ease',
              }}
            >
              <SceneView scene={scene} accent={accent} reveal={reveal} compact={compact} kicker={kicker} reduceMotion={reduceMotion} />
            </motion.div>
          </AnimatePresence>

          {/* Subtitles */}
          {captions && started && !ended && (
            <Subtitle text={scene.narration} progress={progress} accent={accent} />
          )}

          {/* Poster / end screen */}
          {(!started || ended) && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: compact ? '10%' : '6%', background: 'linear-gradient(180deg, rgba(6,11,24,0) 35%, rgba(6,11,24,0.85) 100%)' }}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); play() }}
                aria-label={ended ? 'Replay explainer' : 'Play explainer'}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 22px 12px 14px', borderRadius: 999, border: '1px solid rgba(53,224,255,0.45)', background: 'rgba(8,20,40,0.85)', color: '#e8f0fc', cursor: 'pointer', fontFamily: SANS, fontWeight: 700, fontSize: 15, boxShadow: '0 0 0 6px rgba(53,224,255,0.08), 0 10px 30px rgba(0,0,0,0.4)' }}
              >
                <span style={{ width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #35e0ff, #4f7bff)', color: '#05101f' }}>
                  {ended ? <RotateCcw size={18} /> : <Play size={18} fill="currentColor" style={{ marginLeft: 2 }} />}
                </span>
                {ended ? 'Watch again' : 'Watch the explainer'}
              </button>
              <div style={{ marginTop: 10, fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em', color: 'rgba(232,240,252,0.6)' }}>
                ≈ {totalSeconds < 90 ? `${totalSeconds} SEC` : `${Math.round(totalSeconds / 60)} MIN`} · NARRATED · SUBTITLES
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: '#0a1224', borderTop: '1px solid rgba(53,224,255,0.12)' }}>
          <CtrlButton label={playing ? 'Pause' : 'Play'} onClick={() => (playing ? pause() : play())} primary>
            {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" style={{ marginLeft: 1 }} />}
          </CtrlButton>
          <CtrlButton label="Previous scene" onClick={() => goTo(sceneIdx - 1)} disabled={sceneIdx === 0}><SkipBack size={15} /></CtrlButton>
          <CtrlButton label="Next scene" onClick={() => goTo(sceneIdx + 1)} disabled={sceneIdx === scenes.length - 1}><SkipForward size={15} /></CtrlButton>

          <div style={{ flex: 1, display: 'flex', gap: 4, alignItems: 'center', margin: '0 6px', minWidth: 60 }}>
            {scenes.map((s, i) => {
              const fill = i < sceneIdx ? 1 : i === sceneIdx ? (started ? progress : 0) : 0
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setStarted(true); goTo(i) }}
                  aria-label={`Scene ${i + 1}: ${s.heading}`}
                  title={s.heading}
                  style={{ flex: 1, height: 14, padding: 0, border: 0, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <span style={{ position: 'relative', display: 'block', width: '100%', height: 4, borderRadius: 4, background: 'rgba(232,240,252,0.14)', overflow: 'hidden' }}>
                    <span style={{ position: 'absolute', inset: 0, width: `${fill * 100}%`, background: ACCENT[s.kind], borderRadius: 4, transition: i === sceneIdx ? 'none' : 'width 0.3s' }} />
                  </span>
                </button>
              )
            })}
          </div>

          <CtrlButton label={captions ? 'Hide subtitles' : 'Show subtitles'} onClick={() => setCaptions((c) => !c)} active={captions}>
            {captions ? <Captions size={16} /> : <CaptionsOff size={16} />}
          </CtrlButton>
          <CtrlButton label={muted ? 'Unmute narration' : 'Mute narration'} onClick={toggleMute}>
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </CtrlButton>
          {hookHtml && (
            <CtrlButton label={showText ? 'Hide text version' : 'Read as text'} onClick={() => setShowText((v) => !v)} active={showText}>
              <FileText size={15} />
            </CtrlButton>
          )}
        </div>
      </div>

      {showText && hookHtml && <div className="module-hook" dangerouslySetInnerHTML={{ __html: hookHtml }} />}
    </div>
  )
}

function CtrlButton({ label, onClick, children, primary, active, disabled }: {
  label: string; onClick: () => void; children: React.ReactNode; primary?: boolean; active?: boolean; disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{
        width: primary ? 34 : 30, height: primary ? 34 : 30, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: primary ? '50%' : 8,
        border: primary ? 'none' : '1px solid transparent',
        background: primary ? 'linear-gradient(135deg, #35e0ff, #4f7bff)' : active ? 'rgba(53,224,255,0.12)' : 'transparent',
        color: primary ? '#05101f' : disabled ? 'rgba(232,240,252,0.25)' : active ? '#35e0ff' : 'rgba(232,240,252,0.75)',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function Backdrop({ accent, reduceMotion }: { accent: string; reduceMotion: boolean }) {
  const drift = (dx: number, dy: number, d: number) =>
    reduceMotion ? {} : { animate: { x: [0, dx, 0], y: [0, dy, 0] }, transition: { duration: d, repeat: Infinity, ease: 'easeInOut' as const } }
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.35, backgroundImage: 'linear-gradient(rgba(120,160,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(120,160,255,0.08) 1px, transparent 1px)', backgroundSize: '4cqw 4cqw' }} />
      <motion.div {...drift(30, 20, 14)} style={{ position: 'absolute', width: '55%', height: '70%', left: '-12%', top: '-18%', borderRadius: '50%', background: accent, opacity: 0.1, filter: 'blur(60px)', transition: 'background 0.8s' }} />
      <motion.div {...drift(-24, -16, 18)} style={{ position: 'absolute', width: '50%', height: '60%', right: '-10%', bottom: '-20%', borderRadius: '50%', background: '#7b5cff', opacity: 0.1, filter: 'blur(60px)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)' }} />
    </div>
  )
}

function Subtitle({ text, progress, accent }: { text: string; progress: number; accent: string }) {
  // Highlight the words already spoken, estimated from narration progress
  const words = text.split(/\s+/)
  const spokenChars = progress * text.length
  let acc = 0
  return (
    <div aria-live="off" style={{ position: 'absolute', left: '50%', bottom: '4%', transform: 'translateX(-50%)', width: 'max-content', maxWidth: '88%', zIndex: 2, pointerEvents: 'none' }}>
      <p style={{ margin: 0, padding: '0.55em 0.9em', borderRadius: 10, background: 'rgba(3,7,16,0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', fontFamily: SANS, fontWeight: 600, fontSize: fs(1.85, 12), lineHeight: 1.45, textAlign: 'center' }}>
        {words.map((w, i) => {
          const start = acc
          acc += w.length + 1
          const spoken = start < spokenChars
          return (
            <span key={i} style={{ color: spoken ? '#ffffff' : 'rgba(232,240,252,0.55)', textShadow: spoken ? `0 0 12px ${accent}55` : 'none', transition: 'color 0.15s' }}>
              {w}{i < words.length - 1 ? ' ' : ''}
            </span>
          )
        })}
      </p>
    </div>
  )
}

interface SceneProps {
  scene: ExplainerScene
  accent: string
  reveal: number
  compact: boolean
  kicker: string
  reduceMotion: boolean
}

const appear = (shown: boolean, delay = 0) => ({
  initial: false as const,
  animate: shown ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 14, scale: 0.97 },
  transition: { duration: 0.45, delay, ease: 'easeOut' as const },
})
const shownAt = (i: number, n: number, reveal: number) => reveal >= (n <= 1 ? 0 : (i / n) * 0.75)

function SceneHeading({ scene, accent }: { scene: ExplainerScene; accent: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.4cqw', marginBottom: '3.2cqw' }}>
      <span style={{ display: 'grid', placeItems: 'center', width: fs(4.6, 30), height: fs(4.6, 30), borderRadius: '1.2cqw', background: `${accent}1f`, border: `1px solid ${accent}55` }}>
        <Icon name={scene.icon} size={fs(2.5, 16)} color={accent} />
      </span>
      <h3 style={{ margin: 0, fontFamily: SANS, fontWeight: 800, fontSize: fs(3.3, 17), letterSpacing: '-0.01em', color: '#f3f7ff' }}>{scene.heading}</h3>
    </div>
  )
}

function Card({ accent, children, style }: { accent: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ position: 'relative', borderRadius: '1.6cqw', padding: '2cqw', background: 'linear-gradient(180deg, rgba(20,32,60,0.85), rgba(10,18,36,0.9))', border: `1px solid ${accent}40`, boxShadow: `0 0 0 1px rgba(255,255,255,0.02), 0 10px 30px rgba(0,0,0,0.25)`, ...style }}>
      <span style={{ position: 'absolute', top: 0, left: '12%', right: '12%', height: 1, background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, opacity: 0.7 }} />
      {children}
    </div>
  )
}

function SceneView(props: SceneProps) {
  const { scene } = props
  switch (scene.kind) {
    case 'title': return <TitleScene {...props} />
    case 'stats': return <StatsScene {...props} />
    case 'steps': return <StepsScene {...props} />
    case 'compare': return <CompareScene {...props} />
    case 'timeline': return <TimelineScene {...props} />
    case 'warning': return <WarningScene {...props} />
    case 'checklist': return <ChecklistScene {...props} />
    case 'example': return <ExampleScene {...props} />
    default: return <CardsScene {...props} />
  }
}

function TitleScene({ scene, accent, kicker, reduceMotion }: SceneProps) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ position: 'relative', width: fs(13, 72), height: fs(13, 72), display: 'grid', placeItems: 'center', marginBottom: '3cqw' }}>
        <motion.span
          animate={reduceMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `1.5px dashed ${accent}88` }}
        />
        <span style={{ position: 'absolute', inset: '14%', borderRadius: '50%', background: `radial-gradient(circle, ${accent}33, ${accent}08 70%)`, boxShadow: `0 0 40px ${accent}44` }} />
        <Icon name={scene.icon} size={fs(5.5, 30)} color={accent} />
      </div>
      <div style={{ fontFamily: MONO, fontSize: fs(1.4, 10), letterSpacing: '0.3em', color: accent, marginBottom: '1.4cqw' }}>{kicker}</div>
      <h2 style={{ margin: 0, fontFamily: SANS, fontWeight: 800, fontSize: fs(5.2, 24), lineHeight: 1.1, letterSpacing: '-0.02em', color: '#ffffff', textShadow: `0 0 30px ${accent}40` }}>{scene.heading}</h2>
      {scene.subheading && (
        <p style={{ margin: '1.8cqw 0 0', maxWidth: '80%', fontFamily: SANS, fontSize: fs(2.1, 13), lineHeight: 1.45, color: 'rgba(232,240,252,0.72)' }}>{scene.subheading}</p>
      )}
    </div>
  )
}

// Counts up numeric values like "£10,000" or "3%" when they appear
function CountUpValue({ value, active }: { value: string; active: boolean }) {
  const m = value.match(/^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/)
  const animatable = !!m && (/[£$€]/.test(m[1]) || m[3].startsWith('%') || m[2].includes(','))
  const target = m ? parseFloat(m[2].replace(/,/g, '')) : 0
  const [n, setN] = useState(animatable ? 0 : target)
  useEffect(() => {
    if (!animatable || !active) return
    let raf = 0
    const t0 = performance.now()
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / 900)
      setN(target * (1 - Math.pow(1 - k, 3)))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [animatable, active, target])
  if (!m || !animatable) return <>{value}</>
  const decimals = (m[2].split('.')[1] ?? '').length
  const shown = n.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: m[2].includes(',') })
  return <>{m[1]}{shown}{m[3]}</>
}

function StatsScene({ scene, accent, reveal, compact }: SceneProps) {
  const n = scene.items.length
  return (
    <>
      <SceneHeading scene={scene} accent={accent} />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${compact ? Math.min(n, 2) : n}, 1fr)`, gap: '2.2cqw', alignContent: 'center' }}>
        {scene.items.map((it, i) => {
          const shown = shownAt(i, n, reveal)
          return (
            <motion.div key={i} {...appear(shown)}>
              <Card accent={accent} style={{ textAlign: 'center', padding: '2.6cqw 1.6cqw' }}>
                <Icon name={it.icon} size={fs(2.6, 16)} color={`${accent}cc`} />
                <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: fs(n > 3 ? 4.6 : 6, 24), lineHeight: 1.05, margin: '1cqw 0', background: `linear-gradient(135deg, #ffffff, ${accent})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                  <CountUpValue value={it.value} active={shown} />
                </div>
                <div style={{ fontFamily: MONO, fontSize: fs(1.3, 9.5), letterSpacing: '0.1em', textTransform: 'uppercase', color: '#cfe0ff' }}>{it.label}</div>
                {it.detail && <div style={{ marginTop: '0.8cqw', fontFamily: SANS, fontSize: fs(1.5, 10.5), color: 'rgba(232,240,252,0.6)', lineHeight: 1.35 }}>{it.detail}</div>}
              </Card>
            </motion.div>
          )
        })}
      </div>
    </>
  )
}

function StepsScene({ scene, accent, reveal, compact }: SceneProps) {
  const n = scene.items.length
  return (
    <>
      <SceneHeading scene={scene} accent={accent} />
      <div style={{ flex: 1, display: 'flex', flexDirection: compact ? 'column' : 'row', alignItems: compact ? 'stretch' : 'center', gap: compact ? '2cqw' : 0 }}>
        {scene.items.map((it, i) => {
          const shown = shownAt(i, n, reveal)
          return (
            <React.Fragment key={i}>
              {i > 0 && !compact && (
                <motion.span
                  initial={false}
                  animate={{ scaleX: shown ? 1 : 0, opacity: shown ? 1 : 0 }}
                  transition={{ duration: 0.4 }}
                  style={{ flex: '0 0 3cqw', height: 2, background: `linear-gradient(90deg, ${accent}33, ${accent})`, transformOrigin: 'left', boxShadow: `0 0 8px ${accent}` }}
                />
              )}
              <motion.div {...appear(shown, 0.1)} style={{ flex: 1, minWidth: 0 }}>
                <Card accent={accent} style={{ display: 'flex', flexDirection: compact ? 'row' : 'column', alignItems: compact ? 'center' : 'flex-start', gap: '1.2cqw', minHeight: compact ? 0 : '17cqw' }}>
                  <span style={{ display: 'grid', placeItems: 'center', width: fs(3.6, 24), height: fs(3.6, 24), borderRadius: '50%', background: accent, color: '#05101f', fontFamily: SANS, fontWeight: 800, fontSize: fs(1.7, 11), flexShrink: 0, boxShadow: `0 0 16px ${accent}88` }}>{i + 1}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: fs(1.9, 12), color: '#f3f7ff', lineHeight: 1.25 }}>{it.label}</div>
                    {it.detail && <div style={{ marginTop: '0.6cqw', fontFamily: SANS, fontSize: fs(1.45, 10.5), color: 'rgba(232,240,252,0.62)', lineHeight: 1.35 }}>{it.detail}</div>}
                  </div>
                </Card>
              </motion.div>
            </React.Fragment>
          )
        })}
      </div>
    </>
  )
}

function CompareScene({ scene, accent, reveal, compact }: SceneProps) {
  const [a, b] = scene.items
  const side = (it: typeof a, i: number) => it && (
    <motion.div {...appear(shownAt(i, 2, reveal))} style={{ flex: 1, minWidth: 0 }}>
      <Card accent={i === 0 ? accent : '#35e0ff'} style={{ height: '100%', textAlign: 'center', padding: '2.8cqw 2cqw' }}>
        <Icon name={it.icon} size={fs(4, 24)} color={i === 0 ? accent : '#35e0ff'} />
        {it.value && <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: fs(4.4, 20), color: '#fff', marginTop: '1cqw' }}><CountUpValue value={it.value} active={shownAt(i, 2, reveal)} /></div>}
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: fs(2.1, 13), color: '#f3f7ff', marginTop: '1cqw' }}>{it.label}</div>
        {it.detail && <div style={{ marginTop: '0.8cqw', fontFamily: SANS, fontSize: fs(1.55, 10.5), color: 'rgba(232,240,252,0.62)', lineHeight: 1.4 }}>{it.detail}</div>}
      </Card>
    </motion.div>
  )
  return (
    <>
      <SceneHeading scene={scene} accent={accent} />
      <div style={{ flex: 1, display: 'flex', flexDirection: compact ? 'column' : 'row', alignItems: 'stretch', gap: '2.4cqw' }}>
        {side(a, 0)}
        <div style={{ alignSelf: 'center', fontFamily: MONO, fontWeight: 700, fontSize: fs(1.8, 11), letterSpacing: '0.2em', color: 'rgba(232,240,252,0.5)' }}>VS</div>
        {side(b, 1)}
      </div>
    </>
  )
}

function TimelineScene({ scene, accent, reveal, compact }: SceneProps) {
  const n = scene.items.length
  if (compact) return <CardsScene scene={scene} accent={accent} reveal={reveal} compact kicker="" reduceMotion />
  return (
    <>
      <SceneHeading scene={scene} accent={accent} />
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: '4%', right: '4%', top: '50%', height: 2, background: 'rgba(232,240,252,0.12)' }} />
        <motion.div
          initial={false}
          animate={{ scaleX: Math.min(1, reveal / 0.8) }}
          transition={{ duration: 0.3 }}
          style={{ position: 'absolute', left: '4%', right: '4%', top: '50%', height: 2, background: `linear-gradient(90deg, ${accent}55, ${accent})`, transformOrigin: 'left', boxShadow: `0 0 10px ${accent}` }}
        />
        <div style={{ position: 'relative', width: '100%', display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)` }}>
          {scene.items.map((it, i) => {
            const shown = shownAt(i, n, reveal)
            return (
              <motion.div key={i} {...appear(shown)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 1cqw' }}>
                <div style={{ height: '11cqw', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: '1.6cqw' }}>
                  <Icon name={it.icon} size={fs(2.6, 16)} color={accent} />
                  <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: fs(2.8, 15), color: '#fff', marginTop: '0.6cqw', whiteSpace: 'nowrap' }}>{it.value}</div>
                </div>
                <span style={{ width: '1.8cqw', height: '1.8cqw', minWidth: 10, minHeight: 10, borderRadius: '50%', background: accent, boxShadow: `0 0 0 4px ${accent}33, 0 0 14px ${accent}` }} />
                <div style={{ height: '11cqw', paddingTop: '1.6cqw' }}>
                  <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: fs(1.75, 11.5), color: '#f3f7ff', lineHeight: 1.25 }}>{it.label}</div>
                  {it.detail && <div style={{ marginTop: '0.6cqw', fontFamily: SANS, fontSize: fs(1.4, 10), color: 'rgba(232,240,252,0.6)', lineHeight: 1.35 }}>{it.detail}</div>}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </>
  )
}

function CardsScene({ scene, accent, reveal, compact }: SceneProps) {
  const n = scene.items.length
  const cols = compact ? 1 : n === 4 ? 2 : Math.min(n, 3)
  return (
    <>
      <SceneHeading scene={scene} accent={accent} />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '2cqw', alignContent: 'center' }}>
        {scene.items.map((it, i) => (
          <motion.div key={i} {...appear(shownAt(i, n, reveal))}>
            <Card accent={accent} style={{ display: 'flex', gap: '1.6cqw', alignItems: 'flex-start' }}>
              <span style={{ display: 'grid', placeItems: 'center', width: fs(5, 30), height: fs(5, 30), borderRadius: '1.2cqw', background: `${accent}1a`, flexShrink: 0 }}>
                <Icon name={it.icon} size={fs(2.8, 17)} color={accent} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: fs(2, 12.5), color: '#f3f7ff' }}>
                  {it.value && <span style={{ color: accent, marginRight: '0.8cqw' }}>{it.value}</span>}{it.label}
                </div>
                {it.detail && <div style={{ marginTop: '0.6cqw', fontFamily: SANS, fontSize: fs(1.55, 10.5), color: 'rgba(232,240,252,0.62)', lineHeight: 1.4 }}>{it.detail}</div>}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </>
  )
}

function ExampleScene({ scene, accent, reveal }: SceneProps) {
  const n = scene.items.length
  return (
    <>
      <SceneHeading scene={scene} accent={accent} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Card accent={accent} style={{ width: '100%', maxWidth: '78cqw', padding: '2.6cqw 3cqw' }}>
          <div style={{ fontFamily: MONO, fontSize: fs(1.3, 9.5), letterSpacing: '0.24em', color: accent, marginBottom: '1.6cqw' }}>EXAMPLE</div>
          {scene.items.map((it, i) => (
            <motion.div key={i} {...appear(shownAt(i, n, reveal))} style={{ display: 'flex', gap: '1.6cqw', alignItems: 'flex-start', padding: '1.1cqw 0', borderTop: i ? '1px dashed rgba(232,240,252,0.12)' : 'none' }}>
              <Icon name={it.icon} size={fs(2.4, 15)} color={accent} />
              <div style={{ flex: 1, minWidth: 0, fontFamily: SANS, fontSize: fs(1.8, 12), color: '#f3f7ff', lineHeight: 1.4 }}>
                <strong style={{ fontWeight: 700 }}>{it.label}</strong>
                {it.detail && <span style={{ color: 'rgba(232,240,252,0.68)' }}> — {it.detail}</span>}
              </div>
              {it.value && <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: fs(1.8, 12), color: accent, whiteSpace: 'nowrap' }}>{it.value}</span>}
            </motion.div>
          ))}
        </Card>
      </div>
    </>
  )
}

function WarningScene({ scene, accent, reveal, reduceMotion }: SceneProps) {
  const n = scene.items.length
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.4cqw', marginBottom: '2.4cqw' }}>
        <motion.span
          animate={reduceMotion ? undefined : { scale: [1, 1.12, 1] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          style={{ display: 'grid', placeItems: 'center', width: fs(4.6, 30), height: fs(4.6, 30), borderRadius: '1.2cqw', background: `${accent}26`, border: `1px solid ${accent}77` }}
        >
          <Icon name={scene.icon} size={fs(2.5, 16)} color={accent} />
        </motion.span>
        <h3 style={{ margin: 0, fontFamily: SANS, fontWeight: 800, fontSize: fs(3.3, 17), color: '#fff2f0' }}>{scene.heading}</h3>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '3cqw', paddingBottom: '1cqw' }}>
        {scene.items.map((it, i) => {
          const shown = shownAt(i, n, reveal)
          const h = n === 1 ? 70 : 35 + (i / (n - 1)) * 60
          return (
            <div key={i} style={{ flex: '0 1 24cqw', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', textAlign: 'center' }}>
              <motion.div {...appear(shown, 0.15)} style={{ fontFamily: SANS, fontWeight: 800, fontSize: fs(3.4, 17), color: '#fff', marginBottom: '0.8cqw', whiteSpace: 'nowrap' }}>
                <CountUpValue value={it.value} active={shown} />
              </motion.div>
              <motion.div
                initial={false}
                animate={{ height: shown ? `${h * 0.55}%` : '0%' }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                style={{ width: '100%', borderRadius: '1cqw 1cqw 0.3cqw 0.3cqw', background: `linear-gradient(180deg, ${accent}, ${accent}33)`, boxShadow: `0 0 24px ${accent}55` }}
              />
              <motion.div {...appear(shown, 0.2)} style={{ marginTop: '1cqw' }}>
                <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: fs(1.7, 11), color: '#f3f7ff' }}>{it.label}</div>
                {it.detail && <div style={{ marginTop: '0.4cqw', fontFamily: SANS, fontSize: fs(1.35, 9.5), color: 'rgba(232,240,252,0.6)', lineHeight: 1.35 }}>{it.detail}</div>}
              </motion.div>
            </div>
          )
        })}
      </div>
    </>
  )
}

function ChecklistScene({ scene, accent, reveal, compact }: SceneProps) {
  const n = scene.items.length
  return (
    <>
      <SceneHeading scene={scene} accent={accent} />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: compact || n <= 3 ? '1fr' : '1fr 1fr', gap: '1.6cqw 3cqw', alignContent: 'center' }}>
        {scene.items.map((it, i) => {
          const shown = shownAt(i, n, reveal)
          return (
            <motion.div key={i} {...appear(shown)} style={{ display: 'flex', alignItems: 'center', gap: '1.4cqw', padding: '1.3cqw 1.6cqw', borderRadius: '1.2cqw', background: 'rgba(20,32,60,0.6)', border: '1px solid rgba(232,240,252,0.08)' }}>
              <svg viewBox="0 0 24 24" style={{ width: fs(3, 18), height: fs(3, 18), flexShrink: 0 }} aria-hidden="true">
                <circle cx="12" cy="12" r="10" fill={`${accent}22`} stroke={accent} strokeWidth="1.5" />
                <motion.path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke={accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                  initial={false} animate={{ pathLength: shown ? 1 : 0 }} transition={{ duration: 0.45, delay: 0.15 }} />
              </svg>
              <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: fs(1.9, 12), color: '#f3f7ff' }}>{it.label}</span>
            </motion.div>
          )
        })}
      </div>
    </>
  )
}

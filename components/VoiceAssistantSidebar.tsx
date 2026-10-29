'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import TutorMessage from './TutorMessage'
import type { TutorMode } from './TutorAvatar'
import { Volume2, VolumeX, Mic, MicOff, Send, Pause, Play } from 'lucide-react'
import { startLocalTts, localSpeak, normaliseForSpeech, subscribeLocalTts, localTtsState, pickBrowserVoice, whenAudible } from '@/lib/localTts'
import { EXPLAINER_EVENTS, SECTION_COMPLETE_EVENT, presenterMouth, type ExplainerStateDetail, type ExplainerControlDetail, type ExplainerIdDetail } from '@/lib/tutorPresenter'
import { MOUTH_REST, TextLipSync, VoiceShaper, type MouthShape } from '@/lib/lipSync'


interface VoiceAssistantSidebarProps {
  moduleId: string
  moduleTitle?: string
  partNumber?: number
  partTitle?: string
  currentSection?: { sectionId: string; sectionTitle: string; sectionOrder: number }
  hookText?: string
  /** Explainer video ids the page shows for this section, in the order the tutor presents them */
  videos?: string[]
}

// none → offered (welcome + "watch with your tutor") → presenting → done
type VideoFlow = 'none' | 'offered' | 'presenting' | 'done'

// Per section ("m23/s02"), so each section's video is presented once per browser session
const videoWatchedKey = (sectionKey: string) => `explainer-watched:${sectionKey}`
const videoWatched = (sectionKey: string) => {
  try { return sessionStorage.getItem(videoWatchedKey(sectionKey)) === '1' } catch { return false }
}
const markVideoWatched = (sectionKey: string) => {
  try { sessionStorage.setItem(videoWatchedKey(sectionKey), '1') } catch { /* storage unavailable */ }
}

/** The chat API answered without any reply text; message is the server's code ('unavailable', 'busy', ...) */
class TutorUnavailable extends Error {}

// Seconds between the tutor finishing a section and the next section opening
const AUTO_ADVANCE_SECONDS = 6
const NO_VIDEOS: string[] = []

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_REPLIES = [
  { label: 'Continue', message: 'I understand. I am ready, please continue.' },
  { label: 'Explain simply', message: 'Could you explain that more simply?' },
  { label: 'Give an example', message: 'Could you give me an example from the course material?' },
  { label: 'Repeat that', message: 'Could you repeat the last explanation?' },
] as const

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75]

type ConvState ='idle' | 'listening' | 'processing' | 'speaking'

function stripVisualBlocks(text: string): string {
  return text
    .replace(/\[\[(?:NEXT|STAY|DONE)\]\]/g, '')
    .replace(/\[{1,2}[A-Z]*\]{0,2}\s*$/, '')
    .replace(/:::VISUAL\n?/g, '')
    .replace(/:::(?:PILLARS|STEPS|TERMS|MCQ)[\s\S]*?:::/g, '')
    .replace(/\*\*/g, '')
    .replace(/^\s*(?:#{1,3}\s+|[-*•]\s+|\d+[.)]\s+)/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const TutorAvatar = dynamic(() => import('./TutorAvatar'), { ssr: false })

export default function VoiceAssistantSidebar({
  moduleId,
  moduleTitle,
  partNumber,
  partTitle,
  currentSection,
  videos = NO_VIDEOS,
}: VoiceAssistantSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [videoFlow, setVideoFlowState] = useState<VideoFlow>('none')
  const [videoInfo, setVideoInfo] = useState<ExplainerStateDetail | null>(null)
  const videoFlowRef = useRef<VideoFlow>('none')
  const presentingRef = useRef(false)
  const videosRef = useRef(videos)
  videosRef.current = videos
  const queueRef = useRef<string[]>([])
  const queuePosRef = useRef(0)
  const presentedRef = useRef<string[]>([])
  const [advanceIn, setAdvanceIn] = useState<number | null>(null)
  const setVideoFlow = useCallback((f: VideoFlow) => { videoFlowRef.current = f; setVideoFlowState(f) }, [])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>()
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceUnlocked, setVoiceUnlocked] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [convState, setConvState] = useState<ConvState>('idle')
  const [liveTranscript, setLiveTranscript] = useState('')
  const [voiceSupported, setVoiceSupported] = useState(true)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [isSpeechPaused, setIsSpeechPaused] = useState(false)
  const [speed, setSpeed] = useState(1)
  const speedRef = useRef(1)
  const [localVoiceNote, setLocalVoiceNote] = useState('')
  useEffect(() => {
    startLocalTts()
    const update = () => {
      const { status, percent } = localTtsState()
      setLocalVoiceNote(status === 'loading' ? `Loading natural voice\u2026 ${percent}%` : '')
    }
    update()
    return subscribeLocalTts(update)
  }, [])

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasStarted = useRef(false)
  const sectionIdRef = useRef<string | undefined>(currentSection?.sectionId)

  // Refs for stale-closure-free access
  const voiceUnlockedRef = useRef(false)
  const isMutedRef = useRef(false)
  const pendingTextRef = useRef('')
  const finalTranscriptRef = useRef('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const autoRestartListeningRef = useRef(false)
  const discardTranscriptRef = useRef(false)
  const speechRunRef = useRef(0)

  // Sentence-by-sentence speech: on-device Kokoro voice, browser voice as fallback
  type SpeechItem = { text: string; run: number; audio: Promise<string | null> }
  const speechQueueRef = useRef<SpeechItem[]>([])
  const speechPlayingRef = useRef(false)
  const speechSpokenRef = useRef(0)
  const speechEndedRef = useRef(false)
  const speechDoneRef = useRef<(() => void) | undefined>(undefined)
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const pumpRef = useRef<() => void>(() => {})
  const struggleRef = useRef(0)

  // Lip sync: the neural voice is routed through an analyser; the browser voice follows the words
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const shaperRef = useRef<VoiceShaper | null>(null)
  const textSyncRef = useRef<TextLipSync | null>(null)
  const routedRef = useRef(false)
  const isSpeakingRef = useRef(false)
  const isPausedRef = useRef(false)

  // Lesson structure: teaching points for the current section and where the student is in the loop
  type Phase = 'PRE_NOTES' | 'EXPLAIN' | 'CONFIRM' | 'POST_NOTES' | 'WRAP'
  const pointsRef = useRef<{ titles: string[]; contents: string[] }>({ titles: [], contents: [] })
  const pointIdxRef = useRef(0)
  const phaseRef = useRef<Phase>('PRE_NOTES')

  // Keep refs in sync
  useEffect(() => { voiceUnlockedRef.current = voiceUnlocked }, [voiceUnlocked])
  useEffect(() => { isMutedRef.current = isMuted }, [isMuted])
  useEffect(() => { isSpeakingRef.current = isSpeaking }, [isSpeaking])
  useEffect(() => { isPausedRef.current = isSpeechPaused }, [isSpeechPaused])
  useEffect(() => () => { audioCtxRef.current?.close().catch(() => {}) }, [])

  // Restore the saved tutor voice
  useEffect(() => {
    try {
      const savedSpeed = Number(localStorage.getItem('tutor-voice-speed'))
      if (SPEEDS.includes(savedSpeed)) { setSpeed(savedSpeed); speedRef.current = savedSpeed }
    } catch { /* storage unavailable */ }
  }, [])

  // Applies instantly to the clip that is playing, and to every later one
  const changeSpeed = (s: number) => {
    setSpeed(s)
    speedRef.current = s
    if (audioElRef.current) audioElRef.current.playbackRate = s
    try { localStorage.setItem('tutor-voice-speed', String(s)) } catch { /* storage unavailable */ }
  }

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])


  // Invalidate old utterance callbacks before cancelling so they cannot reset a new turn.
  const stopSpeaking = useCallback(() => {
    speechRunRef.current += 1
    autoRestartListeningRef.current = false
    window.speechSynthesis.cancel()
    speechQueueRef.current.forEach((i) => { i.audio.then((u) => { if (u) URL.revokeObjectURL(u) }) })
    speechQueueRef.current = []
    speechPlayingRef.current = false
    speechEndedRef.current = false
    speechDoneRef.current = undefined
    speechSpokenRef.current = 0
    routedRef.current = false
    textSyncRef.current = null
    if (audioElRef.current) {
      audioElRef.current.onended = null
      audioElRef.current.onerror = null
      audioElRef.current.pause()
      audioElRef.current = null
    }
    setIsSpeaking(false)
    setIsSpeechPaused(false)
  }, [])

  // The module video explainer and the tutor never talk over each other
  useEffect(() => {
    const onExplainerPlay = () => {
      if (!isSpeakingRef.current && speechQueueRef.current.length === 0) return
      stopSpeaking()
      setConvState((s) => (s === 'speaking' ? 'idle' : s))
    }
    window.addEventListener(EXPLAINER_EVENTS.play, onExplainerPlay)
    return () => window.removeEventListener(EXPLAINER_EVENTS.play, onExplainerPlay)
  }, [stopSpeaking])
  useEffect(() => {
    if (isSpeaking) window.dispatchEvent(new Event(EXPLAINER_EVENTS.tutorSpeaking))
  }, [isSpeaking])

  // Chrome speechSynthesis bug fix
  useEffect(() => {
    if (!isSpeaking || isSpeechPaused) return
    const interval = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause()
        window.speechSynthesis.resume()
      }
    }, 10000)
    return () => clearInterval(interval)
  }, [isSpeaking, isSpeechPaused])

  const fetchNeural = useCallback((text: string): Promise<string | null> => localSpeak(normaliseForSpeech(text)), [])

  const speakBrowser = useCallback((text: string, run: number, done: () => void) => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.93 * speedRef.current
    utterance.pitch = 1.0
    const preferred = pickBrowserVoice()
    if (preferred) utterance.voice = preferred
    const sync = new TextLipSync(text, utterance.rate)
    textSyncRef.current = sync
    utterance.addEventListener('boundary', (e) => { if (run === speechRunRef.current) sync.boundary(e.charIndex, e.name) })
    // The mouth starts with the sound, not when the browser first reports the utterance started
    whenAudible(utterance, () => { if (run !== speechRunRef.current) return; sync.start(); setIsSpeaking(true); setConvState('speaking'); setIsSpeechPaused(false) })
    utterance.onend = () => { if (run !== speechRunRef.current) return; sync.finish(); done() }
    utterance.onerror = () => { if (run !== speechRunRef.current) return; done() }
    window.speechSynthesis.speak(utterance)
  }, [])

  const pumpSpeech = useCallback(() => {
    if (speechPlayingRef.current) return
    const item = speechQueueRef.current[0]
    if (!item) {
      if (speechEndedRef.current) {
        const done = speechDoneRef.current
        speechDoneRef.current = undefined
        speechEndedRef.current = false
        setIsSpeaking(false)
        setIsSpeechPaused(false)
        done?.()
      }
      return
    }
    const run = item.run
    if (run !== speechRunRef.current) return
    speechPlayingRef.current = true
    const next = () => {
      if (run !== speechRunRef.current) return
      speechQueueRef.current.shift()
      speechPlayingRef.current = false
      pumpRef.current()
    }
    item.audio.then((url) => {
      if (run !== speechRunRef.current) { if (url) URL.revokeObjectURL(url); return }
      if (!url) { audioElRef.current = null; speakBrowser(item.text, run, next); return }
      const el = new Audio(url)
      audioElRef.current = el
      textSyncRef.current = new TextLipSync(item.text)
      routedRef.current = false
      try {
        const ctx = audioCtxRef.current
        if (ctx && ctx.state === 'running' && analyserRef.current) {
          ctx.createMediaElementSource(el).connect(analyserRef.current)
          routedRef.current = true
        }
      } catch { routedRef.current = false }
      el.playbackRate = speedRef.current
      // 'playing' fires when sound actually starts ('play' fires before the audio is ready)
      el.onplaying = () => { if (run !== speechRunRef.current) return; setIsSpeaking(true); setConvState('speaking'); setIsSpeechPaused(false) }
      el.onended = () => { routedRef.current = false; URL.revokeObjectURL(url); next() }
      el.onerror = () => { URL.revokeObjectURL(url); if (run === speechRunRef.current) { audioElRef.current = null; speakBrowser(item.text, run, next) } }
      el.play().catch(() => { URL.revokeObjectURL(url); if (run === speechRunRef.current) { audioElRef.current = null; speakBrowser(item.text, run, next) } })
    })
  }, [speakBrowser])
  pumpRef.current = pumpSpeech

  // Speak each sentence as soon as it has streamed in, instead of waiting for the whole reply
  const feedSpeech = useCallback((full: string, final: boolean) => {
    if (isMutedRef.current || !voiceUnlockedRef.current) return
    let cut = full.length
    for (const marker of [':::', '[[']) {
      const i = full.indexOf(marker)
      if (i >= 0 && i < cut) cut = i
    }
    const text = full.slice(0, cut).replace(/\*\*/g, '').replace(/^\s*(?:#{1,3}\s+|[-*•]\s+|\d+[.)]\s+)/gm, '')
    const from = Math.min(speechSpokenRef.current, text.length)
    const rest = text.slice(from)
    let end = 0
    if (final) end = rest.length
    else {
      const re = /[.!?…]["')\]]*\s+|\n+/g
      let m: RegExpExecArray | null
      while ((m = re.exec(rest))) end = m.index + m[0].length
    }
    if (end === 0) return
    const chunk = rest.slice(0, end)
    const minLen = from === 0 ? 25 : 60
    if (!final && chunk.trim().length < minLen) return
    speechSpokenRef.current = from + end
    const trimmed = chunk.trim()
    if (!trimmed) return
    speechQueueRef.current.push({ text: trimmed, run: speechRunRef.current, audio: fetchNeural(trimmed) })
    pumpRef.current()
  }, [fetchNeural])

  const beginSpeech = useCallback(() => { stopSpeaking() }, [stopSpeaking])

  const endSpeech = useCallback((full: string, onDone: () => void) => {
    if (isMutedRef.current) { setConvState('idle'); onDone(); return }
    if (!voiceUnlockedRef.current) { pendingTextRef.current = full; setConvState('idle'); return }
    feedSpeech(full, true)
    speechDoneRef.current = onDone
    speechEndedRef.current = true
    pumpRef.current()
  }, [feedSpeech])

  // sendMessage — stable via ref
  const sendMessageImpl = useCallback(async (message: string) => {
    if (isStreaming) return
    setIsStreaming(true)
    setConvState('processing')
    beginSpeech()

    const isAutoStart = message === '__AUTO_START__' || message === '__EXPLAINER_DONE__'
    if (!isAutoStart) setMessages((prev) => [...prev, { role: 'user', content: message }])
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      const body = {
        message, moduleId, sessionId, moduleTitle, partNumber, partTitle, currentSection,
        phase: phaseRef.current,
        struggleCount: struggleRef.current,
        teachingPointIdx: pointIdxRef.current,
        teachingPointTitle: phaseRef.current === 'WRAP' ? null : (pointsRef.current.titles[pointIdxRef.current] ?? null),
        teachingPointContent: phaseRef.current === 'WRAP' ? null : (pointsRef.current.contents[pointIdxRef.current] ?? null),
        totalTeachingPoints: pointsRef.current.titles.length,
        allTeachingPoints: pointsRef.current.titles,
        explainerIds: message === '__EXPLAINER_DONE__' ? presentedRef.current : undefined,
      }
      let fullResponse = ''
      let streamError: string | null = null
      const phaseAtSend = phaseRef.current
      const addToken = (token: string) => {
        fullResponse += token
        feedSpeech(fullResponse, false)
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: fullResponse }
          return updated
        })
      }

      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok || !res.body) throw new Error('Chat API error')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let pending = '' // an event can arrive split across two chunks
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        pending += decoder.decode(value, { stream: true })
        const lines = pending.split('\n')
        pending = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const json = JSON.parse(line.slice(6))
            if (json.error) streamError = String(json.error)
            if (json.token) addToken(json.token)
            if (json.done && json.sessionId) setSessionId(json.sessionId)
          } catch { /* not JSON */ }
        }
      }

      // Never leave an empty bubble: no reply text means the tutor could not answer
      if (streamError || !fullResponse.trim()) throw new TutorUnavailable(streamError ?? 'empty')

      // Track consecutive misses so the tutor can change approach
      if (!isAutoStart) {
        if (phaseAtSend === 'CONFIRM' && /\[\[STAY\]\]/.test(fullResponse)) struggleRef.current += 1
        else struggleRef.current = 0
      }

      // Move the lesson forward when the tutor signals the step is complete
      if (!isAutoStart && /\[\[NEXT\]\]/.test(fullResponse) && pointsRef.current.titles.length > 0) {
        const order: Phase[] = ['PRE_NOTES', 'EXPLAIN', 'CONFIRM', 'POST_NOTES']
        const cur = phaseRef.current
        if (cur === 'POST_NOTES') {
          if (pointIdxRef.current >= pointsRef.current.titles.length - 1) phaseRef.current = 'WRAP'
          else { pointIdxRef.current += 1; phaseRef.current = 'PRE_NOTES' }
        } else if (cur !== 'WRAP') {
          phaseRef.current = order[order.indexOf(cur) + 1]
        }
      }

      // The tutor has finished the whole section: move on by itself once it stops talking
      const sectionDone = !isAutoStart
        && (/\[\[DONE\]\]/.test(fullResponse) || (phaseAtSend === 'WRAP' && /\[\[NEXT\]\]/.test(fullResponse)))

      // After AI speaks, auto-restart listening
      endSpeech(fullResponse, () => {
        setConvState('idle')
        if (sectionDone) setAdvanceIn(AUTO_ADVANCE_SECONDS)
        else autoRestartListeningRef.current = true
      })
      // Without voice there is no speech to wait for
      if (sectionDone && (!voiceUnlockedRef.current || isMutedRef.current)) setAdvanceIn(AUTO_ADVANCE_SECONDS)
    } catch (err) {
      console.error('AI Tutor error:', err)
      stopSpeaking()
      const code = err instanceof TutorUnavailable ? err.message : 'network'
      const notice = code === 'unavailable'
        ? "I'm not available right now: the AI service isn't accepting requests. You can keep reading the lesson and watching the videos, and try me again later."
        : code === 'busy'
          ? "I'm a bit busy right now. Please try again in a minute."
          : "Sorry, I couldn't connect right now. Please try again."
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: notice }
        return updated
      })
      setConvState('idle')
    } finally {
      setIsStreaming(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, sessionId, moduleTitle, partNumber, partTitle, currentSection, isStreaming, beginSpeech, feedSpeech, endSpeech, stopSpeaking])

  const sendMessageRef = useRef(sendMessageImpl)
  useEffect(() => { sendMessageRef.current = sendMessageImpl }, [sendMessageImpl])

  // Start listening — skip if already active
  const isRecognitionActiveRef = useRef(false)
  const startListeningFn = useCallback(() => {
    if (!recognitionRef.current) {
      setVoiceError('Speech recognition is unavailable in this browser. Try Chrome or type your reply below.')
      return
    }
    if (isRecognitionActiveRef.current) return  // Already running
    try {
      setVoiceError(null)
      discardTranscriptRef.current = false
      autoRestartListeningRef.current = false
      pendingTextRef.current = ''
      stopSpeaking()
      setIsSpeaking(false)
      setIsSpeechPaused(false)
      finalTranscriptRef.current = ''
      setLiveTranscript('')
      setConvState('listening')
      isRecognitionActiveRef.current = true
      recognitionRef.current.start()
    } catch (e) {
      console.error('recognition.start error:', e)
      isRecognitionActiveRef.current = false
      setVoiceError('Could not start the microphone. Check microphone access for this site and try again.')
      setConvState('idle')
    }
  }, [stopSpeaking])

  const startListeningRef = useRef(startListeningFn)
  useEffect(() => { startListeningRef.current = startListeningFn }, [startListeningFn])

  // Auto-restart listening after AI finishes
  useEffect(() => {
    if (convState === 'idle' && autoRestartListeningRef.current && voiceUnlocked) {
      autoRestartListeningRef.current = false
      const t = setTimeout(() => startListeningRef.current(), 600)
      return () => clearTimeout(t)
    }
  }, [convState, voiceUnlocked])

  // Initialize SpeechRecognition once on mount
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) { setVoiceSupported(false); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SR()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-GB'

    recognition.onresult = (event: any) => {
      // Accumulate ALL recognized text — both interim and final
      // This ensures onend always has something even if isFinal never fires
      let full = ''
      for (let i = 0; i < event.results.length; i++) {
        full += event.results[i][0].transcript
      }
      finalTranscriptRef.current = full
      setLiveTranscript(full)
    }

    recognition.onend = () => {
      isRecognitionActiveRef.current = false
      const transcript = discardTranscriptRef.current ? '' : finalTranscriptRef.current.trim()
      finalTranscriptRef.current = ''
      setLiveTranscript('')
      if (discardTranscriptRef.current) {
        discardTranscriptRef.current = false
        return
      }
      if (transcript) {
        sendMessageRef.current(transcript)
      } else {
        // No speech detected — go back to idle
        setConvState('idle')
      }
    }

    recognition.onerror = (event: any) => {
      console.error('SpeechRecognition error:', event.error)
      finalTranscriptRef.current = ''
      setLiveTranscript('')
      autoRestartListeningRef.current = false
      const errors: Record<string, string> = {
        'not-allowed': 'Microphone access was blocked. Allow Microphone in Chrome’s site settings, then tap to speak again.',
        'service-not-allowed': 'Chrome’s speech recognition service is unavailable. Check browser settings or type your reply below.',
        'audio-capture': 'No microphone is available. Check your input device and microphone access, then try again.',
        'network': 'Speech recognition could not connect. Check your internet connection and try again.',
        'no-speech': 'No speech was detected. Tap to speak and try again.',
        'language-not-supported': 'English speech recognition is unavailable in this browser. Try Chrome or type your reply below.',
      }
      if (event.error !== 'aborted') {
        setVoiceError(errors[event.error] ?? 'Speech recognition stopped. Tap to speak to try again.')
      }
      isRecognitionActiveRef.current = false
      setConvState('idle')
    }

    recognitionRef.current = recognition
    return () => {
      recognition.onresult = null
      recognition.onend = null
      recognition.onerror = null
      recognition.abort()
      recognitionRef.current = null
      isRecognitionActiveRef.current = false
      autoRestartListeningRef.current = false
      stopSpeaking()
    }
  }, [stopSpeaking]) // stable recognition instance

  const stopListening = useCallback(() => {
    // Just stop recognition, let onend handle sending the message and state changes
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }, [])

  // Create the audio graph inside the user's tap so the browser lets the tutor's voice play
  const unlockAudio = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const AC = window.AudioContext ?? (window as any).webkitAudioContext
        if (AC) {
          const ctx: AudioContext = new AC()
          const analyser = ctx.createAnalyser()
          analyser.fftSize = 1024
          analyser.connect(ctx.destination)
          audioCtxRef.current = ctx
          analyserRef.current = analyser
          shaperRef.current = new VoiceShaper(analyser)
        }
      }
      audioCtxRef.current?.resume().catch(() => {})
    } catch { /* head falls back to a simulated mouth */ }
    voiceUnlockedRef.current = true
    setVoiceUnlocked(true)
  }, [])

  // Start recognition directly from the user's gesture, including permission retries.
  const unlockAndStart = useCallback(() => {
    unlockAudio()
    startListeningFn()
  }, [unlockAudio, startListeningFn])

  // ── Teaching with explainer videos: the module intro (first section) and each section's own video ──
  const sectionMatch = currentSection?.sectionTitle.match(/^(\d+\.\d+)\s+(.*)$/)
  const sectionName = sectionMatch ? `Section ${sectionMatch[1]}: ${sectionMatch[2]}` : (currentSection?.sectionTitle ?? 'This section')
  const welcomeLine = videos[0] === moduleId
    ? `Welcome to Module ${parseInt(moduleId.replace(/\D/g, ''), 10) || ''}${moduleTitle ? `: ${moduleTitle}` : ''}. `
      + `Let's start with a short video overview. I'll talk you through it, then we'll go through the details together.`
    : `${sectionName}. Let's watch a short video on it first. I'll talk you through it, then we'll work through it together.`
  const welcomeLineRef = useRef(welcomeLine)
  welcomeLineRef.current = welcomeLine
  const watchKey = `${moduleId}/${currentSection?.sectionId ?? ''}`
  const watchKeyRef = useRef(watchKey)
  watchKeyRef.current = watchKey

  const presentVideo = useCallback((id: string) => {
    setVideoFlow('presenting')
    window.dispatchEvent(new CustomEvent<ExplainerIdDetail>(EXPLAINER_EVENTS.present, { detail: { id } }))
  }, [setVideoFlow])

  // Present the videos one after another; the tutor follows up after the last one
  const presentQueue = useCallback((ids: string[]) => {
    if (!ids.length) return
    queueRef.current = ids
    queuePosRef.current = 0
    presentVideo(ids[0])
  }, [presentVideo])

  // Say the welcome line, then start the videos
  const introduceVideo = useCallback(() => {
    setVideoFlow('presenting')
    beginSpeech()
    endSpeech(welcomeLineRef.current, () => { setConvState('idle'); presentQueue(videosRef.current) })
  }, [setVideoFlow, beginSpeech, endSpeech, presentQueue])

  const offerVideo = useCallback(() => {
    setVideoFlow('offered')
    setVideoInfo(null)
    setMessages([{ role: 'assistant', content: welcomeLineRef.current }])
    // With voice on, the tutor goes straight into the video; otherwise it waits for a tap
    if (voiceUnlockedRef.current) introduceVideo()
  }, [setVideoFlow, introduceVideo])

  const watchWithTutor = () => {
    unlockAudio()
    introduceVideo()
  }

  // Any time: the tutor stops what it is saying and presents this section's video (again)
  const explainWithVideo = () => {
    const list = videosRef.current
    const id = list.find((v) => v !== moduleId) ?? list[0]
    if (!id) return
    unlockAudio()
    stopSpeaking()
    setAdvanceIn(null)
    setConvState('idle')
    presentQueue([id])
  }

  const skipVideo = () => {
    markVideoWatched(watchKeyRef.current)
    setVideoFlow('done')
    window.dispatchEvent(new CustomEvent<ExplainerControlDetail>(EXPLAINER_EVENTS.control, { detail: { action: 'pause' } }))
    stopSpeaking()
    sendMessageRef.current('__AUTO_START__')
  }

  const controlVideo = (action: ExplainerControlDetail['action']) => {
    window.dispatchEvent(new CustomEvent<ExplainerControlDetail>(EXPLAINER_EVENTS.control, { detail: { id: videoInfo?.id, action } }))
  }

  // Opens each section: the tutor presents its video(s) first, then teaches
  const startLesson = useCallback(() => {
    if (videosRef.current.length && !videoWatched(watchKeyRef.current)) offerVideo()
    else sendMessageRef.current('__AUTO_START__')
  }, [offerVideo])
  const startLessonRef = useRef(startLesson)
  startLessonRef.current = startLesson

  // Follow the videos: the hologram speaks while one narrates, and the tutor teaches on after the last
  useEffect(() => {
    const onState = (e: Event) => {
      const d = (e as CustomEvent<ExplainerStateDetail>).detail
      if (d.state === 'stopped') {
        setVideoInfo((prev) => {
          if (prev?.id !== d.id) return prev
          presentingRef.current = false
          return null
        })
        return
      }
      presentingRef.current = d.state === 'playing'
      setVideoInfo(d)
      const flow = videoFlowRef.current
      if (d.state === 'playing' && flow === 'offered') {
        // The student pressed play on a video themselves: present from that one
        setVideoFlow('presenting')
        const pos = videosRef.current.indexOf(d.id)
        queueRef.current = pos >= 0 ? videosRef.current.slice(pos) : [d.id]
        queuePosRef.current = 0
      }
      if (d.state === 'ended' && (flow === 'offered' || flow === 'presenting') && d.id === queueRef.current[queuePosRef.current]) {
        const next = queueRef.current[queuePosRef.current + 1]
        if (next) {
          queuePosRef.current += 1
          setTimeout(() => { if (videoFlowRef.current === 'presenting') presentVideo(next) }, 800)
          return
        }
        markVideoWatched(watchKeyRef.current)
        setVideoFlow('done')
        presentedRef.current = [...queueRef.current]
        sendMessageRef.current('__EXPLAINER_DONE__')
      }
    }
    window.addEventListener(EXPLAINER_EVENTS.state, onState)
    return () => window.removeEventListener(EXPLAINER_EVENTS.state, onState)
  }, [setVideoFlow, presentVideo])

  // Section finished: after a short countdown the page marks it done and opens the next one
  useEffect(() => {
    if (advanceIn === null) return
    if (advanceIn <= 0) {
      setAdvanceIn(null)
      window.dispatchEvent(new Event(SECTION_COMPLETE_EVENT))
      return
    }
    const t = setTimeout(() => setAdvanceIn((s) => (s === null ? null : s - 1)), 1000)
    return () => clearTimeout(t)
  }, [advanceIn])

  // Auto-start AI greeting on mount
  useEffect(() => {
    if (hasStarted.current || !moduleId) return
    hasStarted.current = true
    const t = setTimeout(() => startLessonRef.current(), 600)
    return () => clearTimeout(t)
  }, [moduleId])

  // Load the section's teaching points and reset the lesson loop
  useEffect(() => {
    const sectionId = currentSection?.sectionId
    pointsRef.current = { titles: [], contents: [] }
    pointIdxRef.current = 0
    phaseRef.current = 'PRE_NOTES'
    struggleRef.current = 0
    if (!sectionId || !moduleId) return
    let cancelled = false
    fetch(`/api/teaching-points?moduleId=${encodeURIComponent(moduleId)}&sectionId=${encodeURIComponent(sectionId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return
        pointsRef.current = { titles: d.points ?? [], contents: d.pointContents ?? [] }
      })
      .catch(() => { /* tutor falls back to free conversation */ })
    return () => { cancelled = true }
  }, [moduleId, currentSection?.sectionId])

  // Restart on section change
  useEffect(() => {
    if (sectionIdRef.current === currentSection?.sectionId) return
    sectionIdRef.current = currentSection?.sectionId
    autoRestartListeningRef.current = false
    discardTranscriptRef.current = true
    finalTranscriptRef.current = ''
    recognitionRef.current?.abort()
    setLiveTranscript('')
    setVoiceError(null)
    setConvState('idle')
    setMessages([])
    setSessionId(undefined)
    stopSpeaking()
    setIsSpeaking(false)
    pendingTextRef.current = ''
    hasStarted.current = false
    setVideoFlow('none')
    setVideoInfo(null)
    setAdvanceIn(null)
    presentingRef.current = false
    queueRef.current = []
    const t = setTimeout(() => { hasStarted.current = true; startLessonRef.current() }, 400)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSection?.sectionId])

  const sendReply = (message: string) => {
    const msg = message.trim()
    if (!msg || isStreaming) return
    setInput('')
    setAdvanceIn(null) // they want to keep talking about this section
    if (videoFlowRef.current === 'offered') setVideoFlow('done') // they chose to talk instead
    stopSpeaking()
    discardTranscriptRef.current = true
    finalTranscriptRef.current = ''
    recognitionRef.current?.abort()
    setLiveTranscript('')
    sendMessageRef.current(msg)
  }

  const handleTextSend = () => sendReply(input)
  const lastMessage = messages[messages.length - 1]
  const showQuickReplies = lastMessage?.role === 'assistant' && Boolean(lastMessage.content.trim())
    && !isStreaming && convState !== 'processing'
    && videoFlow !== 'offered' && videoFlow !== 'presenting' && advanceIn === null

  const toggleMute = () => {
    const next = !isMuted
    setIsMuted(next)
    isMutedRef.current = next
    if (next) { 
      stopSpeaking()
      setIsSpeaking(false)
      setIsSpeechPaused(false)
    }
  }

  const togglePause = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isSpeechPaused) {
      audioElRef.current?.play().catch(() => {})
      window.speechSynthesis.resume()
      setIsSpeechPaused(false)
    } else {
      audioElRef.current?.pause()
      window.speechSynthesis.pause()
      setIsSpeechPaused(true)
    }
  }

  const micLabel =
    convState === 'listening' ? 'Listening…' :
    convState === 'processing' ? 'Processing…' :
    convState === 'speaking' ? 'Speaking…' :
    'Tap to speak'

  const canListen = convState === 'idle' && voiceUnlocked && voiceSupported

  // The avatar's mouth: from the sound itself for the neural voice, from the words for the browser voice
  const getMouth = useCallback((): MouthShape => {
    if (presentingRef.current) return presenterMouth() // speaking the video's narration
    if (!isSpeakingRef.current || isPausedRef.current) return MOUTH_REST
    const sync = textSyncRef.current
    const el = audioElRef.current
    if (el) {
      // Between sentences, while the next clip is still being made, there is nothing to hear
      if (el.paused || el.ended) return MOUTH_REST
      if (routedRef.current && shaperRef.current) return shaperRef.current.shape()
      return sync && el.duration ? sync.shapeAt(el.currentTime / el.duration) : MOUTH_REST
    }
    return sync ? sync.shape() : MOUTH_REST
  }, [])

  const tutorMode: TutorMode =
    (isSpeaking && !isSpeechPaused) || (videoInfo?.state === 'playing' && videoInfo.voiced) ? 'speaking'
    : convState === 'listening' ? 'listening'
    : (convState === 'processing' || isStreaming) ? 'thinking'
    : 'idle'

  return (
    <div style={{ width: '340px', flexShrink: 0, borderLeft: '1px solid rgba(148,163,184,0.2)', background: 'var(--bg-alt)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(148,163,184,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: isSpeaking ? '#10b981' : convState === 'listening' ? '#ef4444' : '#94a3b8', transition: 'background 0.3s' }} />
          <span style={{ fontFamily: '"Montserrat", sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>AI Tutor</span>
          {isStreaming && <span style={{ fontFamily: '"Montserrat", sans-serif', fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>typing…</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={speed}
            onChange={(e) => changeSpeed(Number(e.target.value))}
            title="Speaking speed"
            aria-label="Speaking speed"
            style={{ fontFamily: '"Montserrat", sans-serif', fontSize: 11, color: 'var(--ink)', background: 'transparent', border: '1px solid rgba(148,163,184,0.35)', borderRadius: 8, padding: '3px 4px', cursor: 'pointer' }}
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s} style={{ background: 'var(--bg-alt)', color: 'var(--ink)' }}>{s}x</option>
            ))}
          </select>
          {voiceUnlocked && (
            <button onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isMuted ? '#94a3b8' : '#64748b', display: 'flex', alignItems: 'center', padding: 4 }}>
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          )}
          {!voiceSupported && (
            <span style={{ fontFamily: '"Montserrat", sans-serif', fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: 10 }}>
              Voice input unavailable
            </span>
          )}
        </div>
      </div>

      {/* Animated tutor */}
      <div style={{ padding: '10px 12px 0', flexShrink: 0 }}>
        <TutorAvatar mode={tutorMode} getMouth={getMouth} height={190} />
        {localVoiceNote && (
          <div role="status" style={{ marginTop: 6, textAlign: 'center', fontFamily: '"Montserrat", sans-serif', fontSize: 11, color: '#94a3b8' }}>{localVoiceNote}</div>
        )}
      </div>

      {/* Video overview: offer, then what the tutor is presenting */}
      {videoFlow === 'offered' && videoInfo === null && (
        <div style={{ margin: '10px 12px 0', padding: '12px 14px', borderRadius: 12, background: 'linear-gradient(135deg, rgba(53,224,255,0.1), rgba(79,123,255,0.12))', border: '1px solid rgba(53,224,255,0.35)', flexShrink: 0 }}>
          <div style={{ fontFamily: '"Montserrat", sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: '#35a9d6', marginBottom: 8 }}>
            {videos[0] === moduleId ? 'VIDEO OVERVIEW' : 'SECTION VIDEO'} · ABOUT {videos.length > 1 ? 2 : 1} MIN
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" onClick={watchWithTutor}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px 12px', border: 0, borderRadius: 999, background: 'linear-gradient(135deg, #35e0ff, #4f7bff)', color: '#05101f', fontFamily: '"Montserrat", sans-serif', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              <Play size={14} fill="currentColor" /> Watch with your tutor
            </button>
            <button type="button" onClick={skipVideo}
              style={{ padding: '9px 6px', border: 0, background: 'none', color: 'var(--ink)', opacity: 0.7, fontFamily: '"Montserrat", sans-serif', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Skip
            </button>
          </div>
        </div>
      )}
      {videoInfo && videoInfo.state !== 'ended' && (videoFlow === 'offered' || videoFlow === 'presenting') && (
        <div style={{ margin: '10px 12px 0', padding: '10px 12px', borderRadius: 12, background: 'rgba(53,224,255,0.08)', border: '1px solid rgba(53,224,255,0.3)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button type="button" onClick={() => controlVideo(videoInfo.state === 'playing' ? 'pause' : 'play')}
            aria-label={videoInfo.state === 'playing' ? 'Pause the video' : 'Resume the video'}
            style={{ width: 32, height: 32, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '50%', border: 0, background: 'linear-gradient(135deg, #35e0ff, #4f7bff)', color: '#05101f', cursor: 'pointer' }}>
            {videoInfo.state === 'playing' ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" style={{ marginLeft: 1 }} />}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: '"Montserrat", sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#35a9d6' }}>
              {videoInfo.state === 'playing' ? 'PRESENTING' : 'PAUSED'} · {videoInfo.scene + 1}/{videoInfo.total}
            </div>
            <div style={{ fontFamily: '"Montserrat", sans-serif', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{videoInfo.heading}</div>
          </div>
          <button type="button" onClick={skipVideo}
            style={{ padding: '6px 4px', border: 0, background: 'none', color: 'var(--ink)', opacity: 0.7, fontFamily: '"Montserrat", sans-serif', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Skip to lesson
          </button>
        </div>
      )}
      {advanceIn !== null && (
        <div role="status" style={{ margin: '10px 12px 0', padding: '10px 12px', borderRadius: 12, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.35)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0, fontFamily: '"Montserrat", sans-serif' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#22a55a' }}>SECTION COMPLETE</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>Moving on in {advanceIn}s…</div>
          </div>
          <button type="button" onClick={() => setAdvanceIn(0)}
            style={{ padding: '7px 12px', border: 0, borderRadius: 999, background: '#22a55a', color: '#fff', fontFamily: '"Montserrat", sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Next now
          </button>
          <button type="button" onClick={() => setAdvanceIn(null)}
            style={{ padding: '6px 4px', border: 0, background: 'none', color: 'var(--ink)', opacity: 0.7, fontFamily: '"Montserrat", sans-serif', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Stay here
          </button>
        </div>
      )}

      {/* Unlock prompt */}
      {!voiceUnlocked && videoFlow !== 'offered' && (
        <div onClick={unlockAndStart} style={{ margin: '10px 12px 0', padding: '10px 14px', borderRadius: 10, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.35)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Mic size={14} style={{ color: '#7c3aed', flexShrink: 0 }} />
          <span style={{ fontFamily: '"Montserrat", sans-serif', fontSize: 12, color: '#7c3aed', lineHeight: 1.4, fontWeight: 600 }}>
            Tap to start voice conversation with your tutor
          </span>
        </div>
      )}

      {/* Interactive Avatar Pill */}
      {voiceUnlocked && (
        <div style={{ padding: '24px 24px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            onClick={
              convState === 'speaking' ? startListeningFn :
              canListen ? startListeningFn : 
              convState === 'listening' ? stopListening : undefined
            }
            disabled={convState === 'processing' || !voiceSupported}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: convState === 'listening' ? 'rgba(239, 68, 68, 0.12)' : (isSpeechPaused ? 'rgba(245, 158, 11, 0.12)' : 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(124, 58, 237, 0.15))'),
              color: convState === 'listening' ? '#ef4444' : (isSpeechPaused ? '#f59e0b' : '#7c3aed'),
              border: `1px solid ${convState === 'listening' ? 'rgba(239, 68, 68, 0.25)' : (isSpeechPaused ? 'rgba(245, 158, 11, 0.25)' : 'rgba(124, 58, 237, 0.25)')}`,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              padding: '10px 24px', borderRadius: 40,
              boxShadow: convState === 'listening' 
                ? '0 0 0 6px rgba(239,68,68,0.1)' 
                : '0 4px 14px rgba(124, 58, 237, 0.08)',
              cursor: (canListen || convState === 'listening' || convState === 'speaking') ? 'pointer' : 'default',
              transition: 'all 0.3s ease',
              animation: convState === 'listening' ? 'pulse-ring 1.5s ease-out infinite' : 'none',
              opacity: convState === 'processing' ? 0.9 : 1
            }}
          >
            {/* Icon / Animation */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 20 }}>
              {isSpeaking && !isSpeechPaused ? (
                <>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', animation: 'dot-pulse 1.4s infinite ease-in-out both', animationDelay: '-0.32s' }} />
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', animation: 'dot-pulse 1.4s infinite ease-in-out both', animationDelay: '-0.16s' }} />
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', animation: 'dot-pulse 1.4s infinite ease-in-out both', animationDelay: '0s' }} />
                </>
              ) : isSpeechPaused ? (
                <Play size={16} fill="currentColor" />
              ) : convState === 'processing' ? (
                <>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', animation: 'dot-pulse 1.4s infinite ease-in-out both', animationDelay: '-0.32s' }} />
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', animation: 'dot-pulse 1.4s infinite ease-in-out both', animationDelay: '-0.16s' }} />
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', animation: 'dot-pulse 1.4s infinite ease-in-out both', animationDelay: '0s' }} />
                </>
              ) : convState === 'listening' ? (
                <MicOff size={16} />
              ) : (
                <Mic size={16} />
              )}
            </div>
            
            {/* Status Text */}
            <span style={{ fontFamily: '"Montserrat", sans-serif', fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>
              {isSpeaking ? 'Interrupt & speak' : convState === 'processing' ? 'Thinking' : convState === 'listening' ? 'Listening...' : !voiceSupported ? 'Voice unavailable' : 'Tap to speak'}
            </span>
          </button>
          {isSpeaking && (
            <button type="button" onClick={togglePause}
              aria-label={isSpeechPaused ? 'Resume tutor speech' : 'Pause tutor speech'}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'none', border: 'none', color: 'var(--ink)', cursor: 'pointer', fontSize: 12 }}>
              {isSpeechPaused ? <Play size={14} /> : <Pause size={14} />}
              {isSpeechPaused ? 'Resume tutor' : 'Pause tutor'}
            </button>
          )}
        </div>
      )}

      {voiceError && (
        <div role="alert" style={{ margin: '0 12px 8px', padding: '10px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.1)', color: 'var(--ink)', fontSize: 12, lineHeight: 1.5 }}>
          {voiceError}
        </div>
      )}

      {/* Live transcript while speaking */}
      {liveTranscript && (
        <div style={{ margin: '0 12px 6px', padding: '8px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', flexShrink: 0 }}>
          <span style={{ fontFamily: '"Montserrat", sans-serif', fontSize: 12, color: '#ef4444', fontStyle: 'italic' }}>"{liveTranscript}"</span>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && !isStreaming && (
          <p style={{ fontFamily: '"Montserrat", sans-serif', fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 12, fontStyle: 'italic' }}>
            Your AI tutor is starting up…
          </p>
        )}
        {messages.map((msg, idx) => {
          const isLast = idx === messages.length - 1
          return (
            <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '92%', padding: '8px 12px',
                borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: msg.role === 'user' ? '#7c3aed' : 'rgba(148,163,184,0.15)',
                color: msg.role === 'user' ? '#fff' : 'var(--ink)',
                fontFamily: '"Montserrat", sans-serif', fontSize: 13, lineHeight: 1.5,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {msg.content === '' && isLast && isStreaming
                  ? <span style={{ opacity: 0.5 }}>thinking…</span>
                  : msg.role === 'assistant' ? <TutorMessage content={msg.content} /> : msg.content}
              </div>
            </div>
          )
        })}
      </div>

      {showQuickReplies && (
        <div role="group" aria-label="Suggested replies" style={{ padding: '8px 12px 10px', flexShrink: 0 }}>
          <span style={{ display: 'block', marginBottom: 7, fontSize: 11, color: 'var(--ink)', opacity: 0.65 }}>Quick replies</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {videos.length > 0 && (
              <button type="button" onClick={explainWithVideo}
                style={{ padding: '7px 10px', borderRadius: 16, border: '1px solid rgba(124,58,237,0.5)', background: 'rgba(124,58,237,0.14)', color: 'var(--ink)', fontFamily: '"Montserrat", sans-serif', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Explain with the video
              </button>
            )}
            {QUICK_REPLIES.map(reply => (
              <button key={reply.label} type="button" onClick={() => sendReply(reply.message)}
                style={{ padding: '7px 10px', borderRadius: 16, border: '1px solid rgba(124,58,237,0.25)', background: 'rgba(124,58,237,0.06)', color: 'var(--ink)', fontFamily: '"Montserrat", sans-serif', fontSize: 12, cursor: 'pointer' }}>
                {reply.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Text input fallback */}
      <div style={{ padding: '8px 10px 12px', borderTop: '1px solid rgba(148,163,184,0.2)', display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTextSend() } }}
          placeholder={voiceUnlocked ? 'Or type a reply…' : 'Type your reply…'}
          disabled={isStreaming}
          style={{ flex: 1, padding: '8px 12px', borderRadius: 18, border: '1px solid rgba(148,163,184,0.3)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: '"Montserrat", sans-serif', fontSize: 12, outline: 'none', opacity: isStreaming ? 0.6 : 1 }}
        />
        <button
          onClick={handleTextSend}
          disabled={isStreaming || !input.trim()}
          style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: isStreaming || !input.trim() ? 'rgba(148,163,184,0.2)' : '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isStreaming || !input.trim() ? 'default' : 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
        >
          <Send size={13} />
        </button>
      </div>

      <style>{`
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
          70% { box-shadow: 0 0 0 12px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
        @keyframes ripple {
          0% { transform: scale(0.5); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes dot-pulse {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

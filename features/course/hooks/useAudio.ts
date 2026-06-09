"use client"

import { useState, useRef, useCallback, useEffect } from "react"

export function useAudio() {
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [userActivated, setUserActivated] = useState(false)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])

  const voiceRef = useRef<SpeechSynthesisVoice | null>(null)
  const playingRef = useRef(false)
  // Live "loudness" signal (0..1) the speaking orb reads each frame. Word
  // boundaries spike it; the orb's rAF loop decays it back down so the orb
  // throbs in time with the spoken words.
  const energyRef = useRef(0)
  const bumpEnergy = useCallback((amount = 0.85) => {
    energyRef.current = Math.min(1, energyRef.current + amount)
  }, [])

  // A reply is spoken as a QUEUE of one-utterance-per-sentence. We ref-count
  // the in-flight utterances so `isSpeaking` stays true for the whole reply and
  // doesn't flicker in the brief gaps between queued utterances (which would
  // otherwise make the voice wave blink out mid-speech).
  const speakingCountRef = useRef(0)

  // Chromium silently kills speechSynthesis after ~15s of continuous output.
  // While we're speaking we tick a heartbeat that calls resume() (a no-op when
  // not paused, but it resets Chrome's internal watchdog) so long replies keep
  // going. The same tick also recovers state if the engine drops the queue
  // without firing onend (which would otherwise leave us stuck "speaking").
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const staleTicksRef = useRef(0)
  const stopKeepAlive = useCallback(() => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current)
      keepAliveRef.current = null
    }
    staleTicksRef.current = 0
  }, [])
  const startKeepAlive = useCallback(() => {
    if (keepAliveRef.current) return
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    staleTicksRef.current = 0
    keepAliveRef.current = setInterval(() => {
      const synth = window.speechSynthesis
      // Reset Chrome's 15s cutoff timer.
      synth.resume()
      // Recovery: if we think we're speaking but the engine is actually idle,
      // it dropped the queue — force our state back to "done" after two idle
      // ticks (~10s) so the wave can never get permanently stuck on.
      if (speakingCountRef.current > 0 && !synth.speaking && !synth.pending) {
        staleTicksRef.current += 1
        if (staleTicksRef.current >= 2) {
          speakingCountRef.current = 0
          playingRef.current = false
          setIsSpeaking(false)
          stopKeepAlive()
        }
      } else {
        staleTicksRef.current = 0
      }
    }, 5000)
  }, [stopKeepAlive])

  const beginUtterance = useCallback(() => {
    speakingCountRef.current += 1
    playingRef.current = true
    setIsSpeaking(true)
    startKeepAlive()
  }, [startKeepAlive])
  const endUtterance = useCallback(() => {
    speakingCountRef.current = Math.max(0, speakingCountRef.current - 1)
    if (speakingCountRef.current === 0) {
      playingRef.current = false
      setIsSpeaking(false)
      stopKeepAlive()
    }
  }, [stopKeepAlive])

  const analyserRef = useRef<AnalyserNode | null>(null)
  const bufRef = useRef("")
  const audioRef = useRef(true)
  const speakRef = useRef<(t: string) => void>(() => {})
  const activatedRef = useRef(false)
  // Set by useMic after it initialises
  const startMicRef = useRef<() => void>(() => {})
  const micStoppedRef = useRef(false)
  const micManualRef = useRef(false)
  // Set by the page after useMic initialises, called inside speakText
  const stopMicRef = useRef<() => void>(() => {})

  useEffect(() => { audioRef.current = audioEnabled }, [audioEnabled])
  useEffect(() => { activatedRef.current = userActivated }, [userActivated])

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    const pick = () => {
      const vs = [
        ...window.speechSynthesis.getVoices().filter((v) => v.lang === "en-GB"),
        ...window.speechSynthesis
          .getVoices()
          .filter((v) => v.lang !== "en-GB" && v.lang.startsWith("en")),
      ]
      setAvailableVoices(vs)
      if (!voiceRef.current) voiceRef.current = vs[0] ?? null
    }
    pick()
    window.speechSynthesis.addEventListener("voiceschanged", pick)
    return () => window.speechSynthesis.removeEventListener("voiceschanged", pick)
  }, [])

  // Cancel speech + clear the keep-alive timer on unmount
  useEffect(
    () => () => {
      if (keepAliveRef.current) clearInterval(keepAliveRef.current)
      if (typeof window !== "undefined" && "speechSynthesis" in window)
        window.speechSynthesis.cancel()
    },
    [],
  )

  const speakText = useCallback((text: string, onFinished?: () => void) => {
    if (!audioRef.current) return
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    stopMicRef.current()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = "en-GB"
    u.rate = 1.05
    if (voiceRef.current) u.voice = voiceRef.current
    u.onstart = () => bumpEnergy(1)
    u.onboundary = () => bumpEnergy()
    u.onend = () => {
      endUtterance()
      onFinished?.()
    }
    u.onerror = () => {
      endUtterance()
      onFinished?.()
    }
    beginUtterance()
    window.speechSynthesis.speak(u)
  }, [bumpEnergy, beginUtterance, endUtterance])

  const cancelSpeech = useCallback(() => {
    speakingCountRef.current = 0
    playingRef.current = false
    setIsSpeaking(false)
    stopKeepAlive()
    if (typeof window !== "undefined" && "speechSynthesis" in window)
      window.speechSynthesis.cancel()
    bufRef.current = ""
  }, [stopKeepAlive])

  const speakFinal = useCallback((text: string, onFinished?: () => void) => {
    if (!audioRef.current) {
      onFinished?.()
      return
    }
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      onFinished?.()
      return
    }
    if (!text) {
      onFinished?.()
      return
    }
    const u = new SpeechSynthesisUtterance(text)
    u.lang = "en-GB"
    u.rate = 1.05
    if (voiceRef.current) u.voice = voiceRef.current
    u.onstart = () => bumpEnergy(1)
    u.onboundary = () => bumpEnergy()
    u.onend = () => {
      endUtterance()
      onFinished?.()
    }
    u.onerror = () => {
      endUtterance()
      onFinished?.()
    }
    beginUtterance()
    window.speechSynthesis.speak(u)
  }, [bumpEnergy, beginUtterance, endUtterance])

  const feedToken = useCallback(
    (tok: string) => {
      if (!audioRef.current) return
      bufRef.current += tok
      const blockStart = bufRef.current.search(
        /\n?:::(?:VISUAL|PILLARS|STEPS|TERMS|MCQ)/,
      )
      const speech =
        blockStart >= 0 ? bufRef.current.slice(0, blockStart) : bufRef.current
      if (blockStart >= 0) {
        bufRef.current = speech
        return
      }
      const sm = speech.match(/^([\s\S]*[.!?])\s+(.*)/)
      if (sm) {
        speakText(sm[1])
        bufRef.current = sm[2]
        return
      }
      const cm = speech.match(/^((?:\S+\s+){5,}[\s\S]*?[,;:])\s+(.*)/)
      if (cm) {
        speakText(cm[1])
        bufRef.current = cm[2]
      }
    },
    [speakText],
  )

  const flushSpeech = useCallback(() => {
    const stripped = bufRef.current
      .replace(/:::VISUAL\n?/g, "")
      .replace(/\n?:::[A-Z]+\n[\s\S]*?:::/g, "")
      .trim()
    const r = stripped
    bufRef.current = ""
    const maybeRestartMic = () => {
      if (!micStoppedRef.current && micManualRef.current) startMicRef.current()
    }
    if (audioRef.current && r) {
      speakFinal(r, () => {
        maybeRestartMic()
      })
    } else {
      const wait = () => {
        if (window.speechSynthesis.speaking) setTimeout(wait, 200)
        else {
          speakingCountRef.current = 0
          playingRef.current = false
          setIsSpeaking(false)
          maybeRestartMic()
        }
      }
      if (typeof window !== "undefined" && window.speechSynthesis.speaking) wait()
      else {
        maybeRestartMic()
      }
    }
  }, [speakFinal])

  useEffect(() => {
    speakRef.current = speakText
  }, [speakText])

  return {
    audioEnabled,
    setAudioEnabled,
    isSpeaking,
    setIsSpeaking,
    userActivated,
    setUserActivated,
    availableVoices,
    voiceRef,
    playingRef,
    energyRef,
    analyserRef,
    bufRef,
    audioRef,
    speakRef,
    activatedRef,
    startMicRef,
    micStoppedRef,
    micManualRef,
    stopMicRef,
    speakText,
    cancelSpeech,
    speakFinal,
    feedToken,
    flushSpeech,
  }
}

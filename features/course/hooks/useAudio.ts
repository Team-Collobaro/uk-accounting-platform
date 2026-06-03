"use client"

import { useState, useRef, useCallback, useEffect } from "react"

export function useAudio() {
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [userActivated, setUserActivated] = useState(false)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])

  const voiceRef = useRef<SpeechSynthesisVoice | null>(null)
  const playingRef = useRef(false)
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

  // Cancel speech on unmount
  useEffect(
    () => () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window)
        window.speechSynthesis.cancel()
    },
    [],
  )

  const speakText = useCallback((text: string, onFinished?: () => void) => {
    if (!audioRef.current) return
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    stopMicRef.current()
    playingRef.current = true
    setIsSpeaking(true)
    const u = new SpeechSynthesisUtterance(text)
    u.lang = "en-GB"
    u.rate = 1.05
    if (voiceRef.current) u.voice = voiceRef.current
    u.onend = () => {
      if (!window.speechSynthesis.speaking) {
        playingRef.current = false
        setIsSpeaking(false)
      }
      onFinished?.()
    }
    u.onerror = () => {
      if (!window.speechSynthesis.speaking) {
        playingRef.current = false
        setIsSpeaking(false)
      }
      onFinished?.()
    }
    window.speechSynthesis.speak(u)
  }, [])

  const cancelSpeech = useCallback(() => {
    playingRef.current = false
    setIsSpeaking(false)
    if (typeof window !== "undefined" && "speechSynthesis" in window)
      window.speechSynthesis.cancel()
    bufRef.current = ""
  }, [])

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
    u.onend = () => {
      playingRef.current = false
      setIsSpeaking(false)
      onFinished?.()
    }
    u.onerror = () => {
      playingRef.current = false
      setIsSpeaking(false)
      onFinished?.()
    }
    window.speechSynthesis.speak(u)
  }, [])

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

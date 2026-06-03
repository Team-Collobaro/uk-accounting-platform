"use client"

import { useState, useRef, useCallback, useEffect } from "react"

interface UseMicParams {
  doSendRef: React.MutableRefObject<
    ((text: string, silent: boolean) => Promise<void>) | undefined
  >
  streamRef: React.MutableRefObject<boolean>
  playingRef: React.MutableRefObject<boolean>
  activatedRef: React.MutableRefObject<boolean>
  startMicRef: React.MutableRefObject<() => void>
  micStoppedRef: React.MutableRefObject<boolean>
  micManualRef: React.MutableRefObject<boolean>
  setInput: (v: string) => void
}

export function useMic({
  doSendRef,
  streamRef,
  playingRef,
  activatedRef,
  startMicRef,
  micStoppedRef,
  micManualRef,
  setInput,
}: UseMicParams) {
  const [micActive, setMicActive] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null)
  const micRef = useRef(false)
  const autoMicTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    micRef.current = micActive
  }, [micActive])

  // Stop mic on unmount
  useEffect(
    () => () => {
      recRef.current?.stop()
      if (autoMicTimer.current) clearTimeout(autoMicTimer.current)
    },
    [],
  )

  const startMicImpl = useCallback(() => {
    if (!activatedRef.current || micRef.current || streamRef.current) return
    if (typeof window === "undefined") return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new SR() as any
    rec.lang = "en-GB"
    rec.continuous = false
    rec.interimResults = true
    let got = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (ev: any) => {
      const t = Array.from(
        ev.results as ArrayLike<{
          0: { transcript: string }
          isFinal: boolean
        }>,
      )
        .map((r) => r[0].transcript)
        .join("")
      setInput(t)
      if (
        (ev.results as ArrayLike<{ isFinal: boolean }>)[ev.results.length - 1].isFinal
      ) {
        got = true
        setMicActive(false)
        setInput("")
        if (t.trim()) void doSendRef.current?.(t.trim(), false)
      }
    }
    const restart = (ms: number) => {
      if (
        streamRef.current ||
        playingRef.current ||
        micStoppedRef.current ||
        !micManualRef.current
      )
        return
      autoMicTimer.current = setTimeout(() => {
        if (
          !streamRef.current &&
          !playingRef.current &&
          !micStoppedRef.current &&
          micManualRef.current
        )
          startMicRef.current()
      }, ms)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (ev: any) => {
      setMicActive(false)
      if (ev.error === "no-speech" || ev.error === "audio-capture") restart(500)
    }
    rec.onend = () => {
      setMicActive(false)
      if (!got) restart(300)
    }
    rec.start()
    recRef.current = rec
    setMicActive(true)
  }, [
    activatedRef,
    streamRef,
    playingRef,
    micStoppedRef,
    micManualRef,
    startMicRef,
    doSendRef,
    setInput,
  ])

  useEffect(() => {
    startMicRef.current = startMicImpl
  }, [startMicImpl, startMicRef])

  const toggleMic = useCallback(() => {
    if (micActive) {
      micStoppedRef.current = true
      micManualRef.current = false
      recRef.current?.stop()
      setMicActive(false)
      return
    }
    if (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      !(window as any).SpeechRecognition &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      !(window as any).webkitSpeechRecognition
    ) {
      alert("Speech recognition not supported. Try Chrome or Edge.")
      return
    }
    micStoppedRef.current = false
    micManualRef.current = true
    startMicImpl()
  }, [micActive, startMicImpl, micStoppedRef, micManualRef])

  return {
    micActive,
    setMicActive,
    recRef,
    micRef,
    autoMicTimer,
    toggleMic,
  }
}

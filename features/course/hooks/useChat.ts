"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import type {
  Message,
  Section,
  SectionProgress,
  TeachingPoint,
  TPhase,
} from "@/types/course"

interface UseChatParams {
  moduleId: string
  sectionId?: string
  // Audio callbacks
  cancelSpeech: () => void
  feedToken: (tok: string) => void
  flushSpeech: () => void
  voiceRef: React.MutableRefObject<SpeechSynthesisVoice | null>
  bufRef: React.MutableRefObject<string>
  audioRef: React.MutableRefObject<boolean>
  // Mic refs (owned by useMic / useAudio, written here)
  streamRef: React.MutableRefObject<boolean>
  micRef: React.MutableRefObject<boolean>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recRef: React.MutableRefObject<any>
  setMicActive: (v: boolean) => void
  micStoppedRef: React.MutableRefObject<boolean>
  micManualRef: React.MutableRefObject<boolean>
  autoMicTimer: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  // Teaching-point refs/setters
  tpRef: React.MutableRefObject<TeachingPoint[]>
  tpIdxRef: React.MutableRefObject<number>
  tPhaseRef: React.MutableRefObject<TPhase>
  setTeachingPoints: React.Dispatch<React.SetStateAction<TeachingPoint[]>>
  setCurrentPtIdx: React.Dispatch<React.SetStateAction<number>>
  setTPhase: React.Dispatch<React.SetStateAction<TPhase>>
  // Section refs/setters
  secRef: React.MutableRefObject<Section | null>
  doneSecsRef: React.MutableRefObject<string[]>
  setSectionProgress: React.Dispatch<React.SetStateAction<SectionProgress[]>>
  setSessionKP: React.Dispatch<React.SetStateAction<string[]>>
  // Module data refs
  mTitleRef: React.MutableRefObject<string>
  pNumRef: React.MutableRefObject<number>
  pTitleRef: React.MutableRefObject<string>
}

export function useChat({
  moduleId,
  sectionId,
  cancelSpeech,
  feedToken,
  flushSpeech,
  voiceRef,
  bufRef,
  audioRef,
  streamRef,
  micRef,
  recRef,
  setMicActive,
  micStoppedRef,
  micManualRef,
  autoMicTimer,
  tpRef,
  tpIdxRef,
  tPhaseRef,
  setTeachingPoints,
  setCurrentPtIdx,
  setTPhase,
  secRef,
  doneSecsRef,
  setSectionProgress,
  setSessionKP,
  mTitleRef,
  pNumRef,
  pTitleRef,
}: UseChatParams) {
  const chatKey = sectionId
    ? `chat_history_${moduleId}_${sectionId}`
    : `chat_history_${moduleId}`

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(chatKey)
      return saved ? (JSON.parse(saved) as Message[]) : []
    } catch {
      return []
    }
  })
  const [streaming, setStreaming] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>()
  const [exchangeCount, setExchangeCount] = useState(0)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const msgsRef = useRef<Message[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const sidRef = useRef<string | undefined>()
  const hasStarted = useRef(false)

  // Forwarding ref so useMic can call doSend without a stale closure
  const doSendRef = useRef<
    ((text: string, silent: boolean) => Promise<void>) | undefined
  >()

  useEffect(() => {
    msgsRef.current = messages
  }, [messages])
  useEffect(() => {
    streamRef.current = streaming
  }, [streaming, streamRef])
  useEffect(() => {
    sidRef.current = sessionId
  }, [sessionId])

  // persist chat per section
  useEffect(() => {
    if (messages.length === 0) return
    try {
      localStorage.setItem(chatKey, JSON.stringify(messages))
    } catch {
      /* quota exceeded */
    }
  }, [messages, chatKey])

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streaming])

  // Cleanup on unmount: abort in-flight stream
  useEffect(
    () => () => {
      abortRef.current?.abort()
      abortRef.current = null
    },
    [],
  )

  const stopAll = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    cancelSpeech()
    setStreaming(false)
    bufRef.current = ""
    micStoppedRef.current = true
    micManualRef.current = false
    if (autoMicTimer.current) {
      clearTimeout(autoMicTimer.current)
      autoMicTimer.current = null
    }
    recRef.current?.stop()
    setMicActive(false)
  }, [cancelSpeech, bufRef, micStoppedRef, micManualRef, autoMicTimer, recRef, setMicActive])

  const doSend = useCallback(
    async (text: string, silent: boolean) => {
      if (streamRef.current) return
      if (autoMicTimer.current) {
        clearTimeout(autoMicTimer.current)
        autoMicTimer.current = null
      }
      if (micRef.current) {
        recRef.current?.stop()
        setMicActive(false)
      }
      cancelSpeech()
      setStreaming(true)
      const abort = new AbortController()
      abortRef.current = abort
      if (!silent) {
        setExchangeCount((n) => n + 1)
        setMessages((prev) => [
          ...prev,
          { role: "user", content: text, timestamp: new Date().toISOString() },
        ])
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", timestamp: new Date().toISOString() },
      ])
      try {
        const pts = tpRef.current
        const ptIdx = tpIdxRef.current
        const cp = pts[ptIdx] ?? null
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abort.signal,
          body: JSON.stringify({
            message: text,
            moduleId,
            sessionId: sidRef.current,
            moduleTitle: mTitleRef.current,
            partNumber: pNumRef.current,
            partTitle: pTitleRef.current,
            currentSection: secRef.current
              ? {
                  sectionId: secRef.current.section_id,
                  sectionTitle: secRef.current.section_title,
                  sectionOrder: secRef.current.section_order,
                }
              : undefined,
            completedSections: doneSecsRef.current,
            teachingPointIdx: ptIdx,
            teachingPointTitle: cp?.title ?? null,
            teachingPointContent: cp?.content ?? null,
            totalTeachingPoints: pts.length,
            allTeachingPoints: pts.map((p) => p.title),
            phase: tPhaseRef.current,
          }),
        })
        if (!res.body) throw new Error("no body")
        const reader = res.body.getReader()
        const dec = new TextDecoder()
        let lb = "",
          full = ""
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          lb += dec.decode(value, { stream: true })
          const lines = lb.split("\n")
          lb = lines.pop() ?? ""
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            try {
              const p = JSON.parse(line.slice(6)) as {
                token?: string
                done?: boolean
                sessionId?: string
              }
              if (p.token) {
                const tok = p.token
                full += tok
                setMessages((prev) => {
                  const u = [...prev]
                  u[u.length - 1] = { ...u[u.length - 1], content: full }
                  return u
                })
                feedToken(tok)
              }
              if (p.sessionId) setSessionId(p.sessionId)
              if (p.done) flushSpeech()
            } catch {
              /* ignore */
            }
          }
        }
        flushSpeech()

        if (full.trim()) {
          const msgIdx = msgsRef.current.length - 1

          const mcqCorM = full.match(/:::MCQ[\s\S]*?CORRECT:\s*([A-D])[\s\S]*?:::/)
          const mcqCorrectLetter = mcqCorM ? mcqCorM[1] : undefined

          const wantsVisual =
            /:::VISUAL/.test(full) ||
            /:::(?:PILLARS|STEPS|TERMS)/.test(full) ||
            /(?:three|four|five|2|3|4|5)\s+(?:pillars?|steps?|stages?|types?|principles?|rules?|rates?)/i.test(
              full,
            ) ||
            /£[\d,]+|[\d.]+%/.test(full)

          let svg: string | null = null
          if (wantsVisual) {
            try {
              const vr = await fetch("/api/visual", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  content: full.replace(/:::VISUAL/g, "").slice(0, 800),
                }),
              })
              const vd = (await vr.json()) as { svg: string | null }
              svg = vd.svg ?? null
            } catch {
              svg = null
            }
          }

          setMessages((prev) => {
            const u = [...prev]
            if (u[msgIdx])
              u[msgIdx] = {
                ...u[msgIdx],
                ...(svg ? { visual: svg } : {}),
                ...(mcqCorrectLetter ? { mcqCorrect: mcqCorrectLetter } : {}),
              }
            return u
          })
        }

        if (!silent && full.trim()) {
          const plainFull = full
            .replace(/:::VISUAL\n?/g, "")
            .replace(/\n?:::[A-Z]+\n[\s\S]*?:::/g, "")
            .trim()
          const pts2 = plainFull.match(/[^.!?]+[.!?]/g) ?? []
          const kps = pts2
            .map((s) => s.trim())
            .filter((s) => s.length > 20 && s.length < 200)
            .slice(0, 3)
          if (kps.length) {
            setSessionKP((prev) => {
              const c = [...new Set([...prev, ...kps])].slice(0, 10)
              if (secRef.current)
                void fetch("/api/notes", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    moduleId,
                    sectionId: secRef.current.section_id,
                    sectionTitle: secRef.current.section_title,
                    keyPoints: c,
                    status: "in_progress",
                  }),
                })
              return c
            })
            setSectionProgress((prev) => {
              const ex = prev.find((p) => p.section_id === secRef.current?.section_id)
              if (!ex || !secRef.current) return prev
              return prev.map((p) =>
                p.section_id === secRef.current!.section_id
                  ? {
                      ...p,
                      key_points: [...new Set([...p.key_points, ...kps])].slice(0, 10),
                    }
                  : p,
              )
            })
          }
        }

        if (full.trim()) {
          const ph = tPhaseRef.current
          if (ph === "PRE_NOTES" || text === "__AUTO_START__")
            setTPhase("EXPLAIN")
          else if (ph === "EXPLAIN")
            setTPhase("CONFIRM")
          else if (ph === "CONFIRM")
            setTPhase("POST_NOTES")
          else if (ph === "POST_NOTES")
            setTPhase("CHECK")
          else if (ph === "CHECK") {
            const pts3 = tpRef.current
            const idx = tpIdxRef.current
            const isLast = idx >= pts3.length - 1
            const updated = pts3.map((p, ii) => (ii === idx ? { ...p, done: true } : p))
            setTeachingPoints(updated)
            const nextIdx = isLast ? idx : idx + 1
            setCurrentPtIdx(nextIdx)
            setTPhase(isLast ? "WRAP" : "PRE_NOTES")
            if (secRef.current)
              void fetch("/api/notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  moduleId,
                  sectionId: secRef.current.section_id,
                  sectionTitle: secRef.current.section_title,
                  status: "in_progress",
                  teachingPointIdx: nextIdx,
                  teachingPoints: updated,
                }),
              })
          }
        }
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") {
          setMessages((prev) => {
            const u = [...prev]
            u[u.length - 1] = {
              ...u[u.length - 1],
              content: "Sorry, something went wrong.",
            }
            return u
          })
        }
      } finally {
        setStreaming(false)
        abortRef.current = null
      }
    },
    [
      moduleId,
      cancelSpeech,
      feedToken,
      flushSpeech,
      streamRef,
      micRef,
      recRef,
      setMicActive,
      autoMicTimer,
      tpRef,
      tpIdxRef,
      tPhaseRef,
      secRef,
      doneSecsRef,
      mTitleRef,
      pNumRef,
      pTitleRef,
      setSessionKP,
      setSectionProgress,
      setTeachingPoints,
      setCurrentPtIdx,
      setTPhase,
    ],
  )

  // Keep forwarding ref in sync
  useEffect(() => {
    doSendRef.current = doSend
  }, [doSend])

  const advanceTopic = useCallback(
    (speakFeedback: string) => {
      const pts = tpRef.current
      const idx = tpIdxRef.current
      const isLast = idx >= pts.length - 1
      const updated = pts.map((p, i) => (i === idx ? { ...p, done: true } : p))
      setTeachingPoints(updated)
      const nextIdx = isLast ? idx : idx + 1
      setCurrentPtIdx(nextIdx)
      setTPhase(isLast ? "WRAP" : "PRE_NOTES")
      if (secRef.current) {
        void fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            moduleId,
            sectionId: secRef.current.section_id,
            sectionTitle: secRef.current.section_title,
            status: "in_progress",
            teachingPointIdx: nextIdx,
            teachingPoints: updated,
          }),
        })
      }
      if (speakFeedback) {
        const u = new SpeechSynthesisUtterance(speakFeedback)
        u.lang = "en-GB"
        u.rate = 1.05
        if (voiceRef.current) u.voice = voiceRef.current
        u.onend = () => { void doSend("__AUTO_START__", true) }
        u.onerror = () => { void doSend("__AUTO_START__", true) }
        window.speechSynthesis.speak(u)
      } else {
        void doSend("__AUTO_START__", true)
      }
    },
    [
      moduleId,
      doSend,
      voiceRef,
      tpRef,
      tpIdxRef,
      secRef,
      setTeachingPoints,
      setCurrentPtIdx,
      setTPhase,
    ],
  )

  const resetSection = useCallback(() => {
    try {
      localStorage.removeItem(chatKey)
      if (sectionId) localStorage.removeItem(`tp_progress_${moduleId}_${sectionId}`)
    } catch { /* ignore */ }
    setMessages([])
    setSessionId(undefined)
    setExchangeCount(0)
    hasStarted.current = false
    cancelSpeech()
  }, [chatKey, moduleId, sectionId, cancelSpeech])

  return {
    messages,
    setMessages,
    streaming,
    setStreaming,
    sessionId,
    setSessionId,
    exchangeCount,
    chatEndRef,
    msgsRef,
    abortRef,
    sidRef,
    hasStarted,
    doSendRef,
    doSend,
    advanceTopic,
    stopAll,
    resetSection,
  }
}

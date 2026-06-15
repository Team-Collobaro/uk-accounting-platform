"use client"

import { useState, useRef, useCallback, useEffect } from "react"

interface UseQuizVoiceParams {
  onAnswer: (letter: string) => void
  onSubmit?: () => void
  onMiss?: (transcript: string) => void
  enabled?: boolean
}

const LETTER_MAP: Record<string, string> = {
  "1": "A", "one": "A", "first": "A", "won": "A",
  "2": "B", "two": "B", "second": "B", "to": "B", "too": "B",
  "3": "C", "three": "C", "third": "C", "tree": "C",
  "4": "D", "four": "D", "fourth": "D", "for": "D",
  "letter a": "A", "letter b": "B", "letter c": "C", "letter d": "D",
  "hey": "A", "ay": "A", "eh": "A", "ayy": "A",
  "be": "B", "bee": "B", "bea": "B", "beee": "B",
  "see": "C", "sea": "C", "si": "C", "cee": "C",
  "dee": "D", "di": "D", "de": "D", "the": "D",
}

function extractAnswer(text: string): string | null {
  if (!text) return null
  const lower = text.toLowerCase().trim()

  if (/\b(submit|done|finish|complete)\b/.test(lower)) {
    return "SUBMIT"
  }

  const patterns: RegExp[] = [
    /\b(?:the\s+)?(?:answer|option|choice|selection|select|pick)\s*(?:is\s+)?(?:the\s+)?([abcd])\b/i,
    /\b(?:it(?:'s|\s+is)|that(?:'s|\s+is))\s+(?:the\s+)?(?:option\s+|choice\s+|letter\s+)?([abcd])\b/i,
    /\b(?:i\s+)?(?:go\s+with|choose|chose|pick|say|think|select)\s+(?:option\s+|choice\s+|letter\s+)?([abcd])\b/i,
    /\b(?:number\s+|no\.?\s*|#\s*)([1-4]|one|two|three|four)\b/i,
    /\b(?:the\s+)?(first|second|third|fourth)\s+(?:one|option|answer|choice)\b/i,
    /\bletter\s+([abcd])\b/i,
    /\bletter\s+(be(?:e|a|ee)?|see|sea|si|cee|dee|di|de|hey|ay|eh)\b/i,
  ]

  for (const pattern of patterns) {
    const m = lower.match(pattern)
    if (m && m[1]) {
      const raw = m[1].toLowerCase().trim()
      const letter = LETTER_MAP[raw] || raw.toUpperCase()
      if (letter === "SUBMIT") return "SUBMIT"
      if (["A", "B", "C", "D"].includes(letter)) return letter
    }
  }

  const standaloneLetter = lower.match(/(?:^|\s)([abcd])(?:\b|[.,!?]|$)/)
  if (standaloneLetter && standaloneLetter[1]) {
    return standaloneLetter[1].toUpperCase()
  }
  const standaloneNum = lower.match(/(?:^|\s)([1-4])(?:\s|[.,!?]|$)/)
  if (standaloneNum && standaloneNum[1]) {
    return LETTER_MAP[standaloneNum[1]] ?? null
  }

  // Last resort: scan for any a/b/c/d inside any word. Catches noisy
  // transcripts like "eighty" (no, "B." with stray char) or "B okay" where
  // the strict word-boundary check above failed.
  const anyLetter = lower.match(/[abcd]/)
  if (anyLetter) {
    return anyLetter[0].toUpperCase()
  }

  // Last-last resort: the entire transcript is a single word that's in
  // LETTER_MAP (e.g. "see" → C, "two" → B, "be" → B). Helpful when STT
  // returns just the letter name with no leading "letter" keyword.
  if (lower.length <= 12) {
    const tokens = lower.split(/\s+/)
    if (tokens.length === 1 && LETTER_MAP[tokens[0]]) {
      return LETTER_MAP[tokens[0]]
    }
  }

  return null
}

export function useQuizVoice({ onAnswer, onSubmit, onMiss, enabled = true }: UseQuizVoiceParams) {
  const [active, setActive] = useState(false)
  const [supported, setSupported] = useState(false)
  const [lastTranscript, setLastTranscript] = useState<string>("")
  const recRef = useRef<any>(null)
  // Bumped on every stop()/start() so events from an orphaned recognition
  // instance can be ignored.
  const genRef = useRef(0)
  // Set to true when the user explicitly stops (e.g. clicks the mic off),
  // preventing the auto-restart loop in onend from kicking in.
  const manualStopRef = useRef(false)

  const onAnswerRef = useRef(onAnswer)
  const onSubmitRef = useRef(onSubmit)
  const onMissRef = useRef(onMiss)

  useEffect(() => {
    onAnswerRef.current = onAnswer
    onSubmitRef.current = onSubmit
    onMissRef.current = onMiss
  }, [onAnswer, onSubmit, onMiss])

  useEffect(() => {
    if (typeof window === "undefined") return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setSupported(!!SR && enabled)
  }, [enabled])

  useEffect(() => {
    return () => {
      genRef.current++
      recRef.current?.stop()
      recRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    manualStopRef.current = true
    genRef.current++
    recRef.current?.stop()
    recRef.current = null
    setActive(false)
    setLastTranscript("")
  }, [])

  const start = useCallback(() => {
    if (typeof window === "undefined") return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    // Tear down any prior instance and bump the generation.
    manualStopRef.current = false
    genRef.current++
    recRef.current?.stop()
    recRef.current = null

    const myGen = genRef.current
    const rec = new SR()
    // Use the browser's default locale. Forcing en-US was causing
    // Chrome's recognizer to fail with `onnomatch` for single-letter
    // utterances on en-GB / en-AU users — the locale mismatch dropped
    // confidence below the match threshold.
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 5

    let gotAnswerLocal = false

    // eslint-disable-next-line no-console
    console.log("[quiz-voice] starting recognition, gen=", myGen)

    rec.onresult = (ev: any) => {
      if (myGen !== genRef.current) return
      const resultList: any[] = Array.from(ev.results as ArrayLike<any>)
      const latest: any = resultList[resultList.length - 1]
      if (!latest) return

      let chosen: string | null = null
      let lastTranscriptLocal = ""
      const altCount: number = latest.length || 0
      for (let i = 0; i < altCount && !chosen; i++) {
        const alt: any = latest[i]
        const t: string = (alt && alt.transcript) || ""
        if (t) {
          lastTranscriptLocal = t
          setLastTranscript(t)
          chosen = extractAnswer(t)
        }
      }

      // eslint-disable-next-line no-console
      console.log("[quiz-voice] onresult", {
        isFinal: latest.isFinal,
        transcripts: Array.from({ length: altCount }, (_, i) => latest[i]?.transcript),
        chosen,
      })

      if (!latest.isFinal) return

      // If the latest result didn't decode, scan backwards through earlier
      // results in this session (e.g. interim that had a clean letter
      // before being superseded by the question text being read aloud).
      if (!chosen) {
        for (let r = resultList.length - 2; r >= 0 && !chosen; r--) {
          const result: any = resultList[r]
          if (!result || !result.isFinal) continue
          const alts: number = result.length || 0
          for (let i = 0; i < alts && !chosen; i++) {
            const t: string = (result[i] && result[i].transcript) || ""
            if (t) {
              lastTranscriptLocal = t
              setLastTranscript(t)
              chosen = extractAnswer(t)
            }
          }
        }
        if (chosen) {
          // eslint-disable-next-line no-console
          console.log("[quiz-voice] recovered answer from earlier result:", chosen)
        }
      }

      if (chosen === "SUBMIT") {
        gotAnswerLocal = true
        genRef.current++
        recRef.current?.stop()
        recRef.current = null
        setActive(false)
        onSubmitRef.current?.()
      } else if (chosen) {
        gotAnswerLocal = true
        genRef.current++
        recRef.current?.stop()
        recRef.current = null
        setActive(false)
        onAnswerRef.current(chosen)
      } else {
        // Final result, but no A/B/C/D match. Stop and surface the
        // transcript so the UI can show "didn't catch that".
        gotAnswerLocal = true
        genRef.current++
        recRef.current?.stop()
        recRef.current = null
        setActive(false)
        onMissRef.current?.(lastTranscriptLocal)
      }
    }

    rec.onerror = (ev: any) => {
      if (myGen !== genRef.current) return
      // eslint-disable-next-line no-console
      console.log("[quiz-voice] onerror", ev.error)
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        genRef.current++
        recRef.current = null
        setActive(false)
      }
    }

    rec.onspeechstart = () => {
      if (myGen !== genRef.current) return
      // eslint-disable-next-line no-console
      console.log("[quiz-voice] onspeechstart (mic is picking up audio)")
    }

    rec.onspeechend = () => {
      if (myGen !== genRef.current) return
      // eslint-disable-next-line no-console
      console.log("[quiz-voice] onspeechend (audio ended)")
    }

    rec.onaudiostart = () => {
      if (myGen !== genRef.current) return
      // eslint-disable-next-line no-console
      console.log("[quiz-voice] onaudiostart (mic stream opened)")
    }

    rec.onnomatch = () => {
      if (myGen !== genRef.current) return
      // eslint-disable-next-line no-console
      console.log("[quiz-voice] onnomatch (recognizer couldn't match audio — likely single-letter confusion or low confidence)")
      // Mark as a miss so `onend` doesn't auto-restart. We want the user
      // to see the feedback and try again on their own.
      gotAnswerLocal = true
      onMissRef.current?.("")
    }

    rec.onend = () => {
      if (myGen !== genRef.current) return
      // eslint-disable-next-line no-console
      console.log("[quiz-voice] onend")
      // If we ended without firing a callback (e.g. silence timeout or
      // onnomatch), auto-restart the recognition so the user can keep
      // speaking without re-clicking the mic. Only restart if the user
      // hasn't manually stopped and no answer was captured.
      recRef.current = null
      if (!gotAnswerLocal && !manualStopRef.current) {
        setActive(true)
        // Defer the restart slightly so the browser's recognizer has time
        // to release its session.
        setTimeout(() => {
          if (!manualStopRef.current) start()
        }, 250)
      } else {
        setActive(false)
      }
    }

    try {
      rec.start()
      recRef.current = rec
      setActive(true)
      // eslint-disable-next-line no-console
      console.log("[quiz-voice] start() called OK")
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log("[quiz-voice] start() threw", err)
      setActive(false)
    }
  }, [])

  const toggle = useCallback(() => {
    if (active) {
      stop()
    } else {
      start()
    }
  }, [start, stop, active])

  return {
    active,
    start,
    stop,
    toggle,
    supported,
    lastTranscript,
  }
}

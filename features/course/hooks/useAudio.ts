"use client"

import { useState, useRef, useCallback, useEffect } from "react"

// The two ElevenLabs voices exposed to the UI (one male, one female). The IDs
// match the server route (app/api/tts/route.ts). Default = Daniel (male).
export const TTS_VOICES = [
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", label: "Male (Daniel)" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", label: "Female (Matilda)" },
] as const

type Job = { text: string; onFinished?: () => void }

export function useAudio() {
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [userActivated, setUserActivated] = useState(false)
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceId, setVoiceId] = useState<string>(TTS_VOICES[0].id)

  const voiceRef = useRef<SpeechSynthesisVoice | null>(null)
  const voiceIdRef = useRef<string>(voiceId)
  const playingRef = useRef(false)
  // Live "loudness" signal (0..1) the speaking wave reads each frame. While an
  // ElevenLabs clip plays we feed it real RMS loudness from a Web Audio
  // analyser; on the browser-voice fallback we spike it on word boundaries.
  const energyRef = useRef(0)
  const bumpEnergy = useCallback((amount = 0.85) => {
    energyRef.current = Math.min(1, energyRef.current + amount)
  }, [])

  // A reply is spoken as a QUEUE of one-utterance-per-sentence. We ref-count the
  // in-flight utterances so `isSpeaking` stays true for the whole reply and
  // doesn't flicker in the brief gaps between queued utterances (which would
  // otherwise make the voice wave blink out mid-speech).
  const speakingCountRef = useRef(0)
  const beginUtterance = useCallback(() => {
    speakingCountRef.current += 1
    playingRef.current = true
    setIsSpeaking(true)
  }, [])
  const endUtterance = useCallback(() => {
    speakingCountRef.current = Math.max(0, speakingCountRef.current - 1)
    if (speakingCountRef.current === 0) {
      playingRef.current = false
      setIsSpeaking(false)
    }
  }, [])

  // ── TTS engine state ─────────────────────────────────────────────────────
  // Optimistically use ElevenLabs. Once the route signals it's unavailable
  // (no key, quota exhausted → 401/429, or a network error) we flip this for
  // the rest of the session and use the browser voice, so we don't hammer the
  // route once per sentence when there's nothing to gain.
  const elevenUnavailableRef = useRef(false)
  const queueRef = useRef<Job[]>([])
  const runningRef = useRef(false)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const ttsAbortRef = useRef<AbortController | null>(null)
  // Bumped by cancelSpeech; in-flight fetches/playback that resolve after a
  // cancel compare against this and bail instead of resuming the queue.
  const genRef = useRef(0)

  // ── Web Audio analyser (drives the real audio-reactive wave) ─────────────
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const samplingRafRef = useRef<number | null>(null)

  const ensureCtx = useCallback(() => {
    if (typeof window === "undefined") return null
    if (!audioCtxRef.current) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!Ctx) return null
      const ctx = new Ctx()
      const an = ctx.createAnalyser()
      an.fftSize = 256
      an.smoothingTimeConstant = 0.8
      an.connect(ctx.destination)
      audioCtxRef.current = ctx
      analyserRef.current = an
    }
    if (audioCtxRef.current.state === "suspended") void audioCtxRef.current.resume()
    return audioCtxRef.current
  }, [])

  const stopSampling = useCallback(() => {
    if (samplingRafRef.current != null) cancelAnimationFrame(samplingRafRef.current)
    samplingRafRef.current = null
  }, [])

  const startSampling = useCallback(() => {
    if (samplingRafRef.current != null) return
    const an = analyserRef.current
    if (!an) return
    const data = new Uint8Array(an.fftSize)
    const tick = () => {
      const a = analyserRef.current
      if (!a) {
        samplingRafRef.current = null
        return
      }
      a.getByteTimeDomainData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / data.length)
      energyRef.current = Math.min(1, rms * 3.2)
      samplingRafRef.current = requestAnimationFrame(tick)
    }
    samplingRafRef.current = requestAnimationFrame(tick)
  }, [])

  // ── Browser fallback keep-alive ──────────────────────────────────────────
  // Chromium silently kills speechSynthesis after ~15s of continuous output.
  // While a browser utterance is in flight we tick a heartbeat that calls
  // resume() (a no-op when not paused, but it resets Chrome's watchdog). The
  // same tick recovers a stuck utterance if the engine drops it without firing
  // onend. This only runs on the browser-voice path — ElevenLabs uses <audio>.
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const staleTicksRef = useRef(0)
  const browserActiveRef = useRef(false)
  const browserDoneRef = useRef<(() => void) | null>(null)
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
      synth.resume()
      if (browserActiveRef.current && !synth.speaking && !synth.pending) {
        staleTicksRef.current += 1
        if (staleTicksRef.current >= 2) {
          const done = browserDoneRef.current
          browserActiveRef.current = false
          browserDoneRef.current = null
          stopKeepAlive()
          done?.()
        }
      } else {
        staleTicksRef.current = 0
      }
    }, 5000)
  }, [stopKeepAlive])

  const audioRef = useRef(true)
  const bufRef = useRef("")
  const speakRef = useRef<(t: string) => void>(() => {})
  const activatedRef = useRef(false)
  // Set by useMic after it initialises
  const startMicRef = useRef<() => void>(() => {})
  const micStoppedRef = useRef(false)
  const micManualRef = useRef(false)
  // Set by the page after useMic initialises, called before we speak
  const stopMicRef = useRef<() => void>(() => {})

  useEffect(() => { audioRef.current = audioEnabled }, [audioEnabled])
  useEffect(() => { activatedRef.current = userActivated }, [userActivated])
  useEffect(() => { voiceIdRef.current = voiceId }, [voiceId])

  // Warm up the AudioContext on the first user activation (gesture) so it's
  // resumed and ready before the first clip plays — avoids a suspended context
  // swallowing audio.
  useEffect(() => {
    if (userActivated) ensureCtx()
  }, [userActivated, ensureCtx])

  // Browser voices (used on the ElevenLabs fallback path). Prefer en-GB.
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

  // ── Playback primitives ──────────────────────────────────────────────────

  // Speak one sentence via the browser's Web Speech API. Resolves `done` when
  // the utterance finishes (or errors / goes stale).
  const playBrowser = useCallback(
    (text: string, gen: number, done: () => void) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        done()
        return
      }
      stopMicRef.current()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = "en-GB"
      u.rate = 1.05
      if (voiceRef.current) u.voice = voiceRef.current
      const finish = () => {
        if (!browserActiveRef.current) return
        browserActiveRef.current = false
        browserDoneRef.current = null
        stopKeepAlive()
        done()
      }
      u.onstart = () => bumpEnergy(1)
      u.onboundary = () => bumpEnergy()
      u.onend = finish
      u.onerror = finish
      browserActiveRef.current = true
      browserDoneRef.current = finish
      startKeepAlive()
      if (genRef.current !== gen) {
        finish()
        return
      }
      window.speechSynthesis.speak(u)
    },
    [bumpEnergy, startKeepAlive, stopKeepAlive],
  )

  // Speak one sentence via ElevenLabs. Falls back to the browser voice if the
  // route signals unavailable or anything errors.
  const playEleven = useCallback(
    (text: string, gen: number, done: () => void) => {
      stopMicRef.current()
      const ac = new AbortController()
      ttsAbortRef.current = ac
      fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId: voiceIdRef.current }),
        signal: ac.signal,
      })
        .then(async (res) => {
          if (genRef.current !== gen) {
            done()
            return
          }
          const ct = res.headers.get("Content-Type") ?? ""
          if (!res.ok || !ct.includes("audio")) {
            // Route returned { fallback: true } (no key / quota / error).
            elevenUnavailableRef.current = true
            playBrowser(text, gen, done)
            return
          }
          const buf = await res.arrayBuffer()
          if (genRef.current !== gen) {
            done()
            return
          }
          const ctx = ensureCtx()
          const url = URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }))
          const audio = new Audio(url)
          currentAudioRef.current = audio
          let cleaned = false
          const cleanup = () => {
            if (cleaned) return
            cleaned = true
            URL.revokeObjectURL(url)
            if (currentAudioRef.current === audio) currentAudioRef.current = null
            stopSampling()
            done()
          }
          audio.onended = cleanup
          audio.onerror = cleanup
          // Route through the analyser so the wave reacts to real loudness.
          if (ctx && analyserRef.current) {
            try {
              const src = ctx.createMediaElementSource(audio)
              src.connect(analyserRef.current)
              startSampling()
            } catch {
              /* analyser hookup failed — audio still plays unrouted */
            }
          }
          bumpEnergy(1)
          audio.play().catch(() => cleanup())
        })
        .catch(() => {
          if (ac.signal.aborted || genRef.current !== gen) {
            done()
            return
          }
          elevenUnavailableRef.current = true
          playBrowser(text, gen, done)
        })
    },
    [bumpEnergy, ensureCtx, playBrowser, startSampling, stopSampling],
  )

  const playOne = useCallback(
    (job: Job) =>
      new Promise<void>((resolve) => {
        if (!audioRef.current) {
          resolve()
          return
        }
        const gen = genRef.current
        if (elevenUnavailableRef.current) playBrowser(job.text, gen, resolve)
        else playEleven(job.text, gen, resolve)
      }),
    [playBrowser, playEleven],
  )

  const runQueue = useCallback(() => {
    if (runningRef.current) return
    runningRef.current = true
    const step = () => {
      const job = queueRef.current.shift()
      if (!job) {
        runningRef.current = false
        return
      }
      void playOne(job).then(() => {
        endUtterance()
        job.onFinished?.()
        step()
      })
    }
    step()
  }, [playOne, endUtterance])

  // Public: queue a sentence for speaking. `onFinished` fires after it plays
  // (used by the final flush to restart the mic).
  const enqueue = useCallback(
    (text: string, onFinished?: () => void) => {
      if (!audioRef.current || !text.trim()) {
        onFinished?.()
        return
      }
      queueRef.current.push({ text, onFinished })
      beginUtterance()
      runQueue()
    },
    [beginUtterance, runQueue],
  )

  const speakText = useCallback(
    (text: string, onFinished?: () => void) => enqueue(text, onFinished),
    [enqueue],
  )
  const speakFinal = useCallback(
    (text: string, onFinished?: () => void) => enqueue(text, onFinished),
    [enqueue],
  )

  const cancelSpeech = useCallback(() => {
    genRef.current += 1
    queueRef.current = []
    runningRef.current = false
    speakingCountRef.current = 0
    playingRef.current = false
    setIsSpeaking(false)
    ttsAbortRef.current?.abort()
    ttsAbortRef.current = null
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause()
        currentAudioRef.current.src = ""
      } catch {
        /* ignore */
      }
      currentAudioRef.current = null
    }
    stopSampling()
    browserActiveRef.current = false
    browserDoneRef.current = null
    stopKeepAlive()
    if (typeof window !== "undefined" && "speechSynthesis" in window)
      window.speechSynthesis.cancel()
    bufRef.current = ""
  }, [stopSampling, stopKeepAlive])

  // Accumulate streamed tokens, speaking each complete sentence (or natural
  // clause) as it lands so audio keeps pace with the reply. Skips :::BLOCK
  // markup (visuals/MCQ) so it's never read aloud.
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
      speakFinal(r, () => maybeRestartMic())
    } else {
      const idle = () =>
        queueRef.current.length === 0 &&
        !runningRef.current &&
        !currentAudioRef.current &&
        !(
          typeof window !== "undefined" &&
          "speechSynthesis" in window &&
          window.speechSynthesis.speaking
        )
      const wait = () => {
        if (idle()) maybeRestartMic()
        else setTimeout(wait, 200)
      }
      wait()
    }
  }, [speakFinal])

  useEffect(() => {
    speakRef.current = speakText
  }, [speakText])

  // Cancel speech + tear down audio resources on unmount.
  useEffect(
    () => () => {
      if (keepAliveRef.current) clearInterval(keepAliveRef.current)
      if (samplingRafRef.current != null) cancelAnimationFrame(samplingRafRef.current)
      if (currentAudioRef.current) {
        try {
          currentAudioRef.current.pause()
          currentAudioRef.current.src = ""
        } catch {
          /* ignore */
        }
      }
      if (audioCtxRef.current) void audioCtxRef.current.close().catch(() => {})
      if (typeof window !== "undefined" && "speechSynthesis" in window)
        window.speechSynthesis.cancel()
    },
    [],
  )

  return {
    audioEnabled,
    setAudioEnabled,
    isSpeaking,
    setIsSpeaking,
    userActivated,
    setUserActivated,
    availableVoices,
    voiceRef,
    // ElevenLabs voice toggle
    ttsVoices: TTS_VOICES,
    voiceId,
    setVoiceId,
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

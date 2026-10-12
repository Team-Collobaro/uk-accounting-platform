'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import TutorMessage from './TutorMessage'
import { Volume2, VolumeX, Mic, MicOff, Send, Pause, Play } from 'lucide-react'


interface VoiceAssistantSidebarProps {
  moduleId: string
  moduleTitle?: string
  partNumber?: number
  partTitle?: string
  currentSection?: { sectionId: string; sectionTitle: string; sectionOrder: number }
  hookText?: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_REPLIES = [
  { label: 'Continue', message: 'I understand. Please continue with the next point in this section.' },
  { label: 'Explain simply', message: 'Could you explain that more simply?' },
  { label: 'Give an example', message: 'Could you give me an example from the course material?' },
  { label: 'Repeat that', message: 'Could you repeat the last explanation?' },
] as const

type ConvState = 'idle' | 'listening' | 'processing' | 'speaking'

function stripVisualBlocks(text: string): string {
  return text
    .replace(/:::VISUAL\n?/g, '')
    .replace(/:::(?:PILLARS|STEPS|TERMS|MCQ)[\s\S]*?:::/g, '')
    .replace(/\*\*/g, '')
    .replace(/^\s*(?:#{1,3}\s+|[-*•]\s+|\d+[.)]\s+)/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export default function VoiceAssistantSidebar({
  moduleId,
  moduleTitle,
  partNumber,
  partTitle,
  currentSection,
}: VoiceAssistantSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([])
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

  // Keep refs in sync
  useEffect(() => { voiceUnlockedRef.current = voiceUnlocked }, [voiceUnlocked])
  useEffect(() => { isMutedRef.current = isMuted }, [isMuted])

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])


  // Invalidate old utterance callbacks before cancelling so they cannot reset a new turn.
  const stopSpeaking = useCallback(() => {
    speechRunRef.current += 1
    autoRestartListeningRef.current = false
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
    setIsSpeechPaused(false)
  }, [])

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

  // Core TTS — stable, no stale closures
  const doSpeak = useCallback((text: string, onDone?: () => void) => {
    stopSpeaking()
    const speechRun = speechRunRef.current
    const cleaned = stripVisualBlocks(text)
    if (!cleaned) { onDone?.(); return }

    const utterance = new SpeechSynthesisUtterance(cleaned)
    utterance.rate = 0.93
    utterance.pitch = 1.0

    const applyVoice = () => {
      const voices = window.speechSynthesis.getVoices()
      const preferred = voices.find(
        (v) => v.name.includes('Samantha') || v.name.includes('Daniel') || v.lang === 'en-GB' || v.name.includes('Google UK English')
      )
      if (preferred) utterance.voice = preferred
    }
    applyVoice()
    if (!window.speechSynthesis.getVoices().length) {
      window.speechSynthesis.addEventListener('voiceschanged', applyVoice, { once: true })
    }

    utterance.onstart = () => { if (speechRun !== speechRunRef.current) return; setIsSpeaking(true); setConvState('speaking'); setIsSpeechPaused(false) }
    utterance.onend = () => { if (speechRun !== speechRunRef.current) return; setIsSpeaking(false); setIsSpeechPaused(false); onDone?.() }
    utterance.onerror = () => { if (speechRun !== speechRunRef.current) return; setIsSpeaking(false); setIsSpeechPaused(false); onDone?.() }
    window.speechSynthesis.speak(utterance)
  }, [stopSpeaking])

  const speakText = useCallback((text: string, onDone?: () => void) => {
    if (isMutedRef.current) { setConvState('idle'); onDone?.(); return }
    if (!voiceUnlockedRef.current) {
      pendingTextRef.current = text
      setConvState('idle')
      return
    }
    doSpeak(text, onDone)
  }, [doSpeak])

  // sendMessage — stable via ref
  const sendMessageImpl = useCallback(async (message: string) => {
    if (isStreaming) return
    setIsStreaming(true)
    setConvState('processing')

    const isAutoStart = message === '__AUTO_START__'
    if (!isAutoStart) setMessages((prev) => [...prev, { role: 'user', content: message }])
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, moduleId, sessionId, moduleTitle, partNumber, partTitle, currentSection, phase: 'EXPLAIN' }),
      })

      if (!res.ok || !res.body) throw new Error('Chat API error')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullResponse = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const json = JSON.parse(line.slice(6))
            if (json.token) {
              fullResponse += json.token
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: fullResponse }
                return updated
              })
            }
            if (json.done && json.sessionId) setSessionId(json.sessionId)
          } catch { /* partial */ }
        }
      }

      // After AI speaks, auto-restart listening
      speakText(fullResponse, () => {
        setConvState('idle')
        autoRestartListeningRef.current = true
      })
    } catch (err) {
      console.error('AI Tutor error:', err)
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: "Sorry, I couldn't connect right now. Please try again." }
        return updated
      })
      setConvState('idle')
    } finally {
      setIsStreaming(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, sessionId, moduleTitle, partNumber, partTitle, currentSection, isStreaming, speakText])

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

  // Start recognition directly from the user's gesture, including permission retries.
  const unlockAndStart = useCallback(() => {
    voiceUnlockedRef.current = true
    setVoiceUnlocked(true)
    startListeningFn()
  }, [startListeningFn])

  // Auto-start AI greeting on mount
  useEffect(() => {
    if (hasStarted.current || !moduleId) return
    hasStarted.current = true
    const t = setTimeout(() => sendMessageRef.current('__AUTO_START__'), 600)
    return () => clearTimeout(t)
  }, [moduleId])

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
    const t = setTimeout(() => { hasStarted.current = true; sendMessageRef.current('__AUTO_START__') }, 400)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSection?.sectionId])

  const sendReply = (message: string) => {
    const msg = message.trim()
    if (!msg || isStreaming) return
    setInput('')
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
    && !isStreaming && !isSpeaking && (convState === 'idle' || convState === 'listening')

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
      window.speechSynthesis.resume()
      setIsSpeechPaused(false)
    } else {
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

      {/* Unlock prompt */}
      {!voiceUnlocked && (
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

'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
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

type ConvState = 'idle' | 'listening' | 'processing' | 'speaking'

function stripVisualBlocks(text: string): string {
  return text
    .replace(/:::VISUAL\n?/g, '')
    .replace(/:::(?:PILLARS|STEPS|TERMS|MCQ)[\s\S]*?:::/g, '')
    .replace(/\*\*/g, '')
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
  const convStateRef = useRef<ConvState>('idle')

  // Keep refs in sync
  useEffect(() => { voiceUnlockedRef.current = voiceUnlocked }, [voiceUnlocked])
  useEffect(() => { isMutedRef.current = isMuted }, [isMuted])
  useEffect(() => { convStateRef.current = convState }, [convState])

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])


  // Chrome speechSynthesis bug fix
  useEffect(() => {
    if (!isSpeaking) return
    const interval = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause()
        window.speechSynthesis.resume()
      }
    }, 10000)
    return () => clearInterval(interval)
  }, [isSpeaking])

  // Core TTS — stable, no stale closures
  const doSpeak = useCallback((text: string, onDone?: () => void) => {
    window.speechSynthesis.cancel()
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

    utterance.onstart = () => { setIsSpeaking(true); setConvState('speaking'); setIsSpeechPaused(false) }
    utterance.onend = () => { setIsSpeaking(false); setIsSpeechPaused(false); onDone?.() }
    utterance.onerror = () => { setIsSpeaking(false); setIsSpeechPaused(false); onDone?.() }
    window.speechSynthesis.speak(utterance)
  }, [])

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
    if (!recognitionRef.current) return
    if (isRecognitionActiveRef.current) return  // Already running
    try {
      finalTranscriptRef.current = ''
      setLiveTranscript('')
      setConvState('listening')
      isRecognitionActiveRef.current = true
      recognitionRef.current.start()
    } catch (e) {
      console.error('recognition.start error:', e)
      isRecognitionActiveRef.current = false
      setConvState('idle')
    }
  }, [])

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
    recognition.continuous = true
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
      const transcript = finalTranscriptRef.current.trim()
      finalTranscriptRef.current = ''
      setLiveTranscript('')
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
      if (event.error === 'not-allowed') {
        setVoiceSupported(false)
      }
      isRecognitionActiveRef.current = false
      setConvState('idle')
    }

    recognitionRef.current = recognition
  }, []) // runs once on mount

  const stopListening = useCallback(() => {
    // Just stop recognition, let onend handle sending the message and state changes
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }, [])

  // Unlock voice + queue listening start
  const unlockAndStart = useCallback(() => {
    const silent = new SpeechSynthesisUtterance(' ')
    silent.volume = 0
    window.speechSynthesis.speak(silent)
    voiceUnlockedRef.current = true
    setVoiceUnlocked(true)

    if (pendingTextRef.current && !isMutedRef.current) {
      // Speak queued text then auto-restart listening
      const pending = pendingTextRef.current
      pendingTextRef.current = ''
      setTimeout(() => doSpeak(pending, () => {
        autoRestartListeningRef.current = true
        setConvState('idle')
      }), 150)
    } else {
      // No pending speech — queue listening to start once convState reaches idle
      autoRestartListeningRef.current = true
      // If already idle, trigger the effect immediately
      if (convStateRef.current === 'idle') {
        setTimeout(() => startListeningRef.current(), 400)
      }
      // Otherwise the useEffect will pick it up when convState becomes idle
    }
  }, [doSpeak])

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
    stopListening()
    setMessages([])
    setSessionId(undefined)
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
    pendingTextRef.current = ''
    hasStarted.current = false
    const t = setTimeout(() => { hasStarted.current = true; sendMessageRef.current('__AUTO_START__') }, 400)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSection?.sectionId])

  const handleTextSend = () => {
    const msg = input.trim()
    if (!msg || isStreaming) return
    setInput('')
    sendMessageRef.current(msg)
  }

  const toggleMute = () => {
    const next = !isMuted
    setIsMuted(next)
    isMutedRef.current = next
    if (next) { 
      window.speechSynthesis.cancel()
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
          <span style={{ fontFamily: '"Inter", sans-serif', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>AI Tutor</span>
          {isStreaming && <span style={{ fontFamily: '"Inter", sans-serif', fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>typing…</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {voiceUnlocked && (
            <button onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isMuted ? '#94a3b8' : '#64748b', display: 'flex', alignItems: 'center', padding: 4 }}>
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          )}
          {!voiceSupported && (
            <span style={{ fontFamily: '"Inter", sans-serif', fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: 10 }}>
              Voice input: Chrome only
            </span>
          )}
        </div>
      </div>

      {/* Unlock prompt */}
      {!voiceUnlocked && (
        <div onClick={unlockAndStart} style={{ margin: '10px 12px 0', padding: '10px 14px', borderRadius: 10, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.35)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Mic size={14} style={{ color: '#7c3aed', flexShrink: 0 }} />
          <span style={{ fontFamily: '"Inter", sans-serif', fontSize: 12, color: '#7c3aed', lineHeight: 1.4, fontWeight: 600 }}>
            Tap to start voice conversation with your tutor
          </span>
        </div>
      )}

      {/* Interactive Avatar Pill */}
      {voiceUnlocked && (
        <div style={{ padding: '24px 24px 12px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <button
            onClick={
              convState === 'speaking' ? togglePause :
              canListen ? startListeningFn : 
              convState === 'listening' ? stopListening : undefined
            }
            disabled={convState === 'processing'}
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
            <span style={{ fontFamily: '"Inter", sans-serif', fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>
              {isSpeechPaused ? 'Paused' : isSpeaking ? 'Speaking' : convState === 'processing' ? 'Thinking' : convState === 'listening' ? 'Listening...' : 'Tap to speak'}
            </span>
          </button>
        </div>
      )}

      {/* Live transcript while speaking */}
      {liveTranscript && (
        <div style={{ margin: '0 12px 6px', padding: '8px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', flexShrink: 0 }}>
          <span style={{ fontFamily: '"Inter", sans-serif', fontSize: 12, color: '#ef4444', fontStyle: 'italic' }}>"{liveTranscript}"</span>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && !isStreaming && (
          <p style={{ fontFamily: '"Inter", sans-serif', fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 12, fontStyle: 'italic' }}>
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
                fontFamily: '"Inter", sans-serif', fontSize: 13, lineHeight: 1.5,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {msg.content === '' && isLast && isStreaming
                  ? <span style={{ opacity: 0.5 }}>thinking…</span>
                  : msg.content}
              </div>
            </div>
          )
        })}
      </div>

      {/* Text input fallback */}
      <div style={{ padding: '8px 10px 12px', borderTop: '1px solid rgba(148,163,184,0.2)', display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTextSend() } }}
          placeholder={voiceUnlocked ? 'Or type a reply…' : 'Type your reply…'}
          disabled={isStreaming}
          style={{ flex: 1, padding: '8px 12px', borderRadius: 18, border: '1px solid rgba(148,163,184,0.3)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: '"Inter", sans-serif', fontSize: 12, outline: 'none', opacity: isStreaming ? 0.6 : 1 }}
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

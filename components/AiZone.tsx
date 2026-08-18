'use client'

import React, { useState, useEffect, useRef } from 'react'

interface AiZoneProps {
  sectionTitle: string
  contentHtml: string
  preGeneratedData?: any
}

export default function AiZone({ sectionTitle, contentHtml, preGeneratedData }: AiZoneProps) {
  // Initialize state based on preGeneratedData
  const initialStatus = preGeneratedData?.action?.toLowerCase() || 'none'
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'none' | 'question' | 'example'>(initialStatus as any)
  const [data, setData] = useState<{ question?: string; title?: string; content?: string }>(preGeneratedData || {})
  
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState('')
  const [checking, setChecking] = useState(false)

  // We no longer need to run an analysis useEffect because it's already pre-generated!

  const handleCheck = async () => {
    if (!answer.trim()) return
    setChecking(true)
    setFeedback('')
    
    const plainText = contentHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 800)
    
    try {
      const res = await fetch('/api/check-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: data.question, answer, context: plainText })
      })
      const result = await res.json()
      setFeedback(result.feedback || 'Could not verify answer.')
    } catch (err) {
      setFeedback('Error connecting to verification service.')
    } finally {
      setChecking(false)
    }
  }

  if (status === 'idle' || status === 'none') return null

  if (status === 'analyzing') {
    return (
      <div className="ai-loading" style={{ margin: '12px 0 0', opacity: 0.5 }}>
        <span className="dot-pulse"><span></span><span></span><span></span></span>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#7c3aed' }}>
          analysing section...
        </span>
      </div>
    )
  }

  if (status === 'question') {
    return (
      <div className="ai-card">
        <div className="ai-card-header">✦ Practice Question</div>
        <div className="ai-card-body">
          <p style={{ margin: '0 0 8px', fontWeight: 600 }}>{data.question}</p>
          <div className="ai-answer-row">
            <textarea 
              className="ai-answer-input" 
              placeholder="Type your answer here..." 
              rows={2}
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              disabled={checking || feedback !== ''}
            />
            <button 
              className="btn-answer" 
              onClick={handleCheck}
              disabled={checking || feedback !== ''}
            >
              Check &rarr;
            </button>
          </div>
          {(feedback || checking) && (
            <div className={`ai-feedback show`}>
              {checking ? (
                <>
                  <span className="dot-pulse" style={{ marginRight: 8 }}><span></span><span></span><span></span></span> 
                  Checking...
                </>
              ) : (
                feedback
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (status === 'example') {
    return (
      <div className="ai-card">
        <div className="ai-card-header">✦ Worked Example</div>
        <div className="ai-card-body">
          <strong style={{ display: 'block', marginBottom: 8 }}>{data.title}</strong>
          <p style={{ margin: 0 }}>{data.content}</p>
        </div>
      </div>
    )
  }

  if (status === 'none') {
    return null
  }

  return null
}

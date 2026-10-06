'use client'

import { useState } from 'react'
import type { PublicQuizQuestion } from '@/types'

interface QuizResult {
  score: number
  total: number
  percentage: number
  passed: boolean
  explanations: Record<string, { correct: string; explanation: string; userAnswer: string }>
}

interface SecureQuizProps {
  moduleId: string
  moduleTitle: string
  alreadyPassed: boolean
  onPassed: () => void
}

export default function SecureQuiz({ moduleId, moduleTitle, alreadyPassed, onPassed }: SecureQuizProps) {
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<PublicQuizQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<QuizResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const startQuiz = async () => {
    setLoading(true)
    setError('')
    setResult(null)
    setAnswers({})
    try {
      const response = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, moduleTitle, count: 10 }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to create the assessment')
      setAttemptId(data.attemptId)
      setQuestions(data.questions)
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Unable to create the assessment')
    } finally {
      setLoading(false)
    }
  }

  const submitQuiz = async () => {
    if (!attemptId || questions.some((question) => !answers[question.id])) return
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId, answers }),
      })
      const data = await response.json()
      if (!response.ok) {
        if ([404, 409, 410].includes(response.status)) {
          setAttemptId(null)
          setQuestions([])
          setAnswers({})
        }
        throw new Error(data.error || 'Unable to submit the assessment')
      }
      setResult(data as QuizResult)
      if (data.passed) onPassed()
      window.dispatchEvent(new Event('progress-updated'))
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit the assessment')
    } finally {
      setSubmitting(false)
    }
  }

  if (!attemptId || result) {
    return (
      <div style={{ maxWidth: 640, margin: '28px auto', padding: 28, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--bg-alt)', fontFamily: 'Montserrat, sans-serif' }}>
        {result ? (
          <>
            <p style={{ margin: 0, color: result.passed ? '#15803d' : '#b91c1c', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {result.passed ? 'Assessment passed' : 'Review and try again'}
            </p>
            <h3 style={{ margin: '8px 0', fontSize: 30 }}>{result.percentage}%</h3>
            <p style={{ color: 'var(--ink-soft)', lineHeight: 1.6 }}>
              You answered {result.score} of {result.total} questions correctly. A score of 70% is required.
            </p>
            <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
              {questions.map((question) => {
                const explanation = result.explanations[question.id]
                const correct = explanation?.userAnswer === explanation?.correct ||
                  explanation?.userAnswer?.trim().toUpperCase().startsWith(explanation?.correct?.trim().toUpperCase())
                return (
                  <div key={question.id} style={{ padding: 14, borderRadius: 8, background: correct ? 'rgba(21,128,61,0.08)' : 'rgba(185,28,28,0.08)' }}>
                    <strong style={{ fontSize: 13 }}>{correct ? 'Correct' : `Correct answer: ${explanation?.correct}`}</strong>
                    <p style={{ margin: '5px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--ink-soft)' }}>{explanation?.explanation}</p>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <p style={{ margin: 0, color: 'var(--accent)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Secure knowledge check</p>
            <h3 style={{ margin: '8px 0 10px', fontSize: 24 }}>{alreadyPassed ? 'Module already passed' : 'Ready to begin?'}</h3>
            <p style={{ color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 22 }}>
              {alreadyPassed
                ? 'Your module completion is saved. You may retake this 10-question assessment for practice.'
                : 'You will answer 10 questions in a 45-minute attempt. Score 70% or more to complete this module.'}
            </p>
          </>
        )}
        {error && <p role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{error}</p>}
        <button
          type="button"
          onClick={startQuiz}
          disabled={loading}
          style={{ border: 0, borderRadius: 8, padding: '11px 18px', background: 'var(--accent-2)', color: '#fff', fontWeight: 800, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.65 : 1 }}
        >
          {loading ? 'Preparing questions…' : result ? 'Start a new attempt' : alreadyPassed ? 'Retake assessment' : 'Start assessment'}
        </button>
      </div>
    )
  }

  const allAnswered = questions.every((question) => Boolean(answers[question.id]))
  return (
    <div style={{ maxWidth: 720, margin: '24px auto', fontFamily: 'Montserrat, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
        <div>
          <p style={{ margin: 0, color: 'var(--accent)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Secure knowledge check</p>
          <h3 style={{ margin: '5px 0 0' }}>{moduleTitle}</h3>
        </div>
        <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{Object.keys(answers).length}/{questions.length} answered</span>
      </div>
      <div style={{ display: 'grid', gap: 18 }}>
        {questions.map((question, questionIndex) => (
          <fieldset key={question.id} style={{ margin: 0, padding: 20, border: '1px solid var(--line)', borderRadius: 10 }}>
            <legend style={{ padding: '0 6px', fontWeight: 800, lineHeight: 1.5 }}>{questionIndex + 1}. {question.question}</legend>
            <div style={{ display: 'grid', gap: 9, marginTop: 12 }}>
              {question.options.map((option) => (
                <label key={option} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 11, border: '1px solid var(--line-soft)', borderRadius: 8, cursor: 'pointer', background: answers[question.id] === option ? 'rgba(29,78,216,0.08)' : 'transparent' }}>
                  <input
                    type="radio"
                    name={question.id}
                    value={option}
                    checked={answers[question.id] === option}
                    onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))}
                  />
                  <span style={{ fontSize: 14, lineHeight: 1.5 }}>{option}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      {error && <p role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{error}</p>}
      <button
        type="button"
        onClick={submitQuiz}
        disabled={!allAnswered || submitting}
        style={{ marginTop: 22, border: 0, borderRadius: 8, padding: '12px 20px', background: 'var(--accent-2)', color: '#fff', fontWeight: 800, cursor: allAnswered && !submitting ? 'pointer' : 'not-allowed', opacity: allAnswered && !submitting ? 1 : 0.5 }}
      >
        {submitting ? 'Submitting…' : allAnswered ? 'Submit assessment' : 'Answer every question to submit'}
      </button>
    </div>
  )
}

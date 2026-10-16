'use client'

import { useState } from 'react'
import type { PublicQuizQuestion } from '@/types'
import ExamTools from '@/components/ExamTools'
import './SecureQuiz.css'

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
      <div className="secure-quiz secure-quiz-intro">
        {result ? (
          <>
            <p className={`secure-quiz-status ${result.passed ? 'passed' : 'failed'}`}>
              {result.passed ? 'Assessment passed' : 'Review and try again'}
            </p>
            <h3 className="secure-quiz-score">{result.percentage}%</h3>
            <p className="secure-quiz-copy">
              You answered {result.score} of {result.total} questions correctly. A score of 70% is required.
            </p>
            <div className="secure-quiz-review">
              {questions.map((question) => {
                const explanation = result.explanations[question.id]
                const correct = explanation?.userAnswer === explanation?.correct ||
                  explanation?.userAnswer?.trim().toUpperCase().startsWith(explanation?.correct?.trim().toUpperCase())
                return (
                  <div key={question.id} className={`secure-quiz-review-item ${correct ? 'correct' : 'incorrect'}`}>
                    <strong>{correct ? 'Correct' : `Correct answer: ${explanation?.correct}`}</strong>
                    <p>{explanation?.explanation}</p>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <p className="secure-quiz-eyebrow">Secure knowledge check</p>
            <h3 className="secure-quiz-intro-title">{alreadyPassed ? 'Module already passed' : 'Ready to begin?'}</h3>
            <p className="secure-quiz-copy secure-quiz-intro-copy">
              {alreadyPassed
                ? 'Your module completion is saved. You may retake this assessment for practice.'
                : 'Answer the multiple-choice questions in a 45-minute attempt. Score 70% or more to complete this module.'}
            </p>
          </>
        )}
        {error && <p role="alert" className="secure-quiz-error">{error}</p>}
        <button
          className="secure-quiz-primary-button"
          type="button"
          onClick={startQuiz}
          disabled={loading}
        >
          {loading ? 'Preparing questions…' : result ? 'Start a new attempt' : alreadyPassed ? 'Retake assessment' : 'Start assessment'}
        </button>
      </div>
    )
  }

  const allAnswered = questions.every((question) => Boolean(answers[question.id]))
  return (
    <div className="secure-quiz secure-quiz-active">
      <div className="secure-quiz-heading">
        <div>
          <p className="secure-quiz-eyebrow">Secure knowledge check</p>
          <h3>{moduleTitle}</h3>
        </div>
        <span className="secure-quiz-progress">{Object.keys(answers).length}/{questions.length} answered</span>
      </div>
      <ExamTools />
      <div className="secure-quiz-questions">
        {questions.map((question, questionIndex) => (
          <fieldset key={question.id} className="secure-quiz-question">
            <legend><span>{questionIndex + 1}</span>{question.question}</legend>
            <div className="secure-quiz-options">
              {question.options.map((option) => (
                <label key={option} className={answers[question.id] === option ? 'selected' : ''}>
                  <input
                    type="radio"
                    name={question.id}
                    value={option}
                    checked={answers[question.id] === option}
                    onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      {error && <p role="alert" className="secure-quiz-error">{error}</p>}
      <button
        className="secure-quiz-primary-button secure-quiz-submit"
        type="button"
        onClick={submitQuiz}
        disabled={!allAnswered || submitting}
      >
        {submitting ? 'Submitting…' : allAnswered ? 'Submit assessment' : 'Answer every question to submit'}
      </button>
    </div>
  )
}

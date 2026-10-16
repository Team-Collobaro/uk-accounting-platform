'use client'

import { useState } from 'react'
import { Calculator, Delete, NotebookPen, Trash2, X } from 'lucide-react'
import './ExamTools.css'

type Tool = 'calculator' | 'notes' | null
type Operator = '+' | '−' | '×' | '÷'

const MAX_NOTE_LENGTH = 5000

function formatResult(value: number) {
  if (!Number.isFinite(value)) return 'Error'
  const rounded = Math.round((value + Number.EPSILON) * 1e10) / 1e10
  return String(rounded).slice(0, 16)
}

function calculate(left: number, right: number, operator: Operator) {
  if (operator === '+') return left + right
  if (operator === '−') return left - right
  if (operator === '×') return left * right
  return right === 0 ? Number.NaN : left / right
}

function ExamCalculator() {
  const [display, setDisplay] = useState('0')
  const [storedValue, setStoredValue] = useState<number | null>(null)
  const [operator, setOperator] = useState<Operator | null>(null)
  const [waitingForOperand, setWaitingForOperand] = useState(false)

  const reset = () => {
    setDisplay('0')
    setStoredValue(null)
    setOperator(null)
    setWaitingForOperand(false)
  }

  const enterDigit = (digit: string) => {
    if (display === 'Error' || waitingForOperand) {
      setDisplay(digit)
      setWaitingForOperand(false)
      return
    }
    if (display.replace('-', '').replace('.', '').length >= 14) return
    setDisplay(display === '0' ? digit : `${display}${digit}`)
  }

  const enterDecimal = () => {
    if (display === 'Error' || waitingForOperand) {
      setDisplay('0.')
      setWaitingForOperand(false)
    } else if (!display.includes('.')) {
      setDisplay(`${display}.`)
    }
  }

  const chooseOperator = (nextOperator: Operator) => {
    const current = Number(display)
    if (!Number.isFinite(current)) {
      reset()
      return
    }

    if (storedValue !== null && operator && !waitingForOperand) {
      const result = calculate(storedValue, current, operator)
      const formatted = formatResult(result)
      setDisplay(formatted)
      setStoredValue(formatted === 'Error' ? null : result)
    } else {
      setStoredValue(current)
    }
    setOperator(nextOperator)
    setWaitingForOperand(true)
  }

  const resolve = () => {
    if (storedValue === null || !operator || waitingForOperand) return
    const result = calculate(storedValue, Number(display), operator)
    setDisplay(formatResult(result))
    setStoredValue(null)
    setOperator(null)
    setWaitingForOperand(true)
  }

  const toggleSign = () => {
    if (display === '0' || display === 'Error') return
    setDisplay(display.startsWith('-') ? display.slice(1) : `-${display}`)
  }

  const percentage = () => {
    if (display === 'Error') return
    setDisplay(formatResult(Number(display) / 100))
  }

  const backspace = () => {
    if (display === 'Error' || waitingForOperand) return
    const next = display.slice(0, -1)
    setDisplay(next && next !== '-' ? next : '0')
  }

  return (
    <div className="exam-calculator" aria-label="Exam calculator">
      <div className="exam-calculator-display" aria-live="polite">
        <small>{storedValue !== null && operator ? `${formatResult(storedValue)} ${operator}` : 'CALCULATOR'}</small>
        <strong>{display}</strong>
      </div>
      <div className="exam-calculator-grid">
        <button type="button" className="utility" onClick={reset}>AC</button>
        <button type="button" className="utility" onClick={toggleSign}>±</button>
        <button type="button" className="utility" onClick={percentage}>%</button>
        <button type="button" className="operator" onClick={() => chooseOperator('÷')}>÷</button>
        {['7', '8', '9'].map(digit => <button type="button" key={digit} onClick={() => enterDigit(digit)}>{digit}</button>)}
        <button type="button" className="operator" onClick={() => chooseOperator('×')}>×</button>
        {['4', '5', '6'].map(digit => <button type="button" key={digit} onClick={() => enterDigit(digit)}>{digit}</button>)}
        <button type="button" className="operator" onClick={() => chooseOperator('−')}>−</button>
        {['1', '2', '3'].map(digit => <button type="button" key={digit} onClick={() => enterDigit(digit)}>{digit}</button>)}
        <button type="button" className="operator" onClick={() => chooseOperator('+')}>+</button>
        <button type="button" className="backspace" onClick={backspace} aria-label="Delete last digit"><Delete size={17} /></button>
        <button type="button" onClick={() => enterDigit('0')}>0</button>
        <button type="button" onClick={enterDecimal}>.</button>
        <button type="button" className="equals" onClick={resolve}>=</button>
      </div>
    </div>
  )
}

export default function ExamTools() {
  const [activeTool, setActiveTool] = useState<Tool>(null)
  const [notes, setNotes] = useState('')

  const toggleTool = (tool: Exclude<Tool, null>) => {
    setActiveTool(current => current === tool ? null : tool)
  }

  return (
    <section className={`exam-tools ${activeTool ? 'open' : ''}`} aria-label="Exam tools">
      <div className="exam-tools-bar">
        <div>
          <span>Exam tools</span>
          <small>Use these without leaving the secure assessment</small>
        </div>
        <div className="exam-tools-actions">
          <button type="button" className={activeTool === 'calculator' ? 'active' : ''} onClick={() => toggleTool('calculator')} aria-expanded={activeTool === 'calculator'}>
            <Calculator size={16} /> Calculator
          </button>
          <button type="button" className={activeTool === 'notes' ? 'active' : ''} onClick={() => toggleTool('notes')} aria-expanded={activeTool === 'notes'}>
            <NotebookPen size={16} /> Notebook
          </button>
        </div>
      </div>

      {activeTool && (
        <div className="exam-tool-panel">
          <div className="exam-tool-panel-head">
            <div>
              <strong>{activeTool === 'calculator' ? 'Calculator' : 'Scratch notebook'}</strong>
              <small>{activeTool === 'calculator' ? 'Basic arithmetic for your working' : 'Notes stay on this device and are not submitted'}</small>
            </div>
            <button type="button" onClick={() => setActiveTool(null)} aria-label="Close exam tool"><X size={18} /></button>
          </div>

          {activeTool === 'calculator' ? (
            <ExamCalculator />
          ) : (
            <div className="exam-notebook">
              <textarea
                value={notes}
                onChange={event => setNotes(event.target.value.slice(0, MAX_NOTE_LENGTH))}
                maxLength={MAX_NOTE_LENGTH}
                placeholder="Write calculations, reminders or working notes here…"
                aria-label="Exam scratch notes"
              />
              <div className="exam-notebook-footer">
                <span>{notes.length.toLocaleString()} / {MAX_NOTE_LENGTH.toLocaleString()}</span>
                <button type="button" onClick={() => setNotes('')} disabled={!notes}><Trash2 size={14} /> Clear notes</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

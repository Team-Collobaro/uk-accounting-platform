import { describe, it, expect, beforeEach } from 'vitest'
import { TimedDetectionEngine } from './detectionPolicy'

describe('TimedDetectionEngine', () => {
  let engine: TimedDetectionEngine

  beforeEach(() => {
    engine = TimedDetectionEngine.secondPerson(2000)
  })

  it('starts in clear phase', () => {
    expect(engine.phase).toBe('clear')
    expect(engine.isFlagged).toBe(false)
    expect(engine.isWarning).toBe(false)
  })

  it('transitions to suspected (warning) on first positive observation', () => {
    const t0 = 1000
    const transition = engine.record({ at: t0, detected: true, confidence: 0.9 })
    expect(transition).toBe('warning')
    expect(engine.phase).toBe('suspected')
    expect(engine.isWarning).toBe(true)
    expect(engine.isFlagged).toBe(false)
  })

  it('transitions to confirmed on repeated positive detections within window', () => {
    const t0 = 1000
    engine.record({ at: t0, detected: true, confidence: 0.85 })

    // Second positive 300ms later (strong confidence >= 0.6)
    const t1 = 1300
    const transition = engine.record({ at: t1, detected: true, confidence: 0.85 })

    expect(transition).toBe('confirmed')
    expect(engine.phase).toBe('confirmed')
    expect(engine.isFlagged).toBe(true)
  })

  it('remains locked after a single clean observation once confirmed', () => {
    const t0 = 1000
    engine.record({ at: t0, detected: true, confidence: 0.9 })
    engine.record({ at: 1300, detected: true, confidence: 0.9 })
    expect(engine.phase).toBe('confirmed')

    // Single clean frame 200ms later
    const transition = engine.record({ at: 1500, detected: false })
    expect(transition).toBe('none')
    expect(engine.phase).toBe('confirmed')
    expect(engine.isFlagged).toBe(true)
  })

  it('resolves only after continuous clean view for recoveryMs', () => {
    const t0 = 1000
    engine.record({ at: t0, detected: true, confidence: 0.9 })
    engine.record({ at: 1300, detected: true, confidence: 0.9 })
    expect(engine.phase).toBe('confirmed')

    // Clean frame at 2000 (700ms clean, recovery is 2000ms)
    expect(engine.record({ at: 2000, detected: false })).toBe('none')
    expect(engine.phase).toBe('confirmed')

    // Clean frame at 3000 (1700ms clean, recovery is 2000ms)
    expect(engine.record({ at: 3000, detected: false })).toBe('none')
    expect(engine.phase).toBe('confirmed')

    // Clean frame at 3350 (2050ms continuous clean since 1300)
    const transition = engine.record({ at: 3350, detected: false })
    expect(transition).toBe('resolved')
    expect(engine.phase).toBe('clear')
    expect(engine.isFlagged).toBe(false)
  })

  it('resets clean timer if violation reappears before recovery completes', () => {
    const t0 = 1000
    engine.record({ at: t0, detected: true, confidence: 0.9 })
    engine.record({ at: 1300, detected: true, confidence: 0.9 })
    expect(engine.phase).toBe('confirmed')

    // Clean at 2500 (1200ms clean)
    engine.record({ at: 2500, detected: false })

    // Violation reappears at 2800!
    engine.record({ at: 2800, detected: true, confidence: 0.9 })
    expect(engine.phase).toBe('confirmed')

    // Clean at 4000 (1200ms since 2800, not enough for 2000ms recovery)
    expect(engine.record({ at: 4000, detected: false })).toBe('none')
    expect(engine.phase).toBe('confirmed')

    // Clean at 4850 (2050ms continuous clean since 2800)
    expect(engine.record({ at: 4850, detected: false })).toBe('resolved')
    expect(engine.phase).toBe('clear')
  })

  it('clears warning if no subsequent confirmation occurs within window', () => {
    const t0 = 1000
    engine.record({ at: t0, detected: true, confidence: 0.5 })
    expect(engine.phase).toBe('suspected')

    // Clean observations well past warningWindowMs (1500ms)
    const transition = engine.record({ at: 3100, detected: false })
    expect(transition).toBe('warningCleared')
    expect(engine.phase).toBe('clear')
  })

  it('presence factory creates engine with appropriate defaults', () => {
    const presenceEngine = TimedDetectionEngine.presence(3000)
    expect(presenceEngine.recoveryMs).toBe(3000)
    expect(presenceEngine.warningPositives).toBe(2)
  })
})

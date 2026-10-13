import {
  DetectionObservation,
  DetectionPhase,
  DetectionPolicyConfig,
  DetectionTransition,
} from './types'

export class TimedDetectionEngine {
  public readonly warningPositives: number
  public readonly warningWindowMs: number
  public readonly strongConfirmPositives: number
  public readonly strongConfirmWindowMs: number
  public readonly weakConfirmPositives: number
  public readonly weakConfirmWindowMs: number
  public readonly strongConfidence: number
  public readonly recoveryMs: number
  public readonly maxHistory: number

  private positives: DetectionObservation[] = []
  private _phase: DetectionPhase = 'clear'
  private lastPositiveAt: number | null = null
  private cleanSinceLastPositive: boolean = false

  constructor(config: DetectionPolicyConfig = {}) {
    this.warningPositives = config.warningPositives ?? 1
    this.warningWindowMs = config.warningWindowMs ?? 1500
    this.strongConfirmPositives = config.strongConfirmPositives ?? 2
    this.strongConfirmWindowMs = config.strongConfirmWindowMs ?? 1000
    this.weakConfirmPositives = config.weakConfirmPositives ?? 3
    this.weakConfirmWindowMs = config.weakConfirmWindowMs ?? 1500
    this.strongConfidence = config.strongConfidence ?? 0.6
    this.recoveryMs = config.recoveryMs ?? 2000
    this.maxHistory = config.maxHistory ?? 64
  }

  public static secondPerson(recoveryMs: number = 2000): TimedDetectionEngine {
    return new TimedDetectionEngine({
      warningPositives: 1,
      warningWindowMs: 1500,
      strongConfirmPositives: 2,
      strongConfirmWindowMs: 1000,
      weakConfirmPositives: 3,
      weakConfirmWindowMs: 1500,
      recoveryMs,
    })
  }

  public static presence(recoveryMs: number = 2500): TimedDetectionEngine {
    return new TimedDetectionEngine({
      warningPositives: 2,
      warningWindowMs: 2500,
      strongConfirmPositives: 3,
      strongConfirmWindowMs: 3000,
      weakConfirmPositives: 4,
      weakConfirmWindowMs: 3500,
      recoveryMs,
    })
  }

  public static object(recoveryMs: number = 2500): TimedDetectionEngine {
    return new TimedDetectionEngine({
      warningPositives: 1,
      warningWindowMs: 1500,
      strongConfirmPositives: 2,
      strongConfirmWindowMs: 1500,
      weakConfirmPositives: 3,
      weakConfirmWindowMs: 2000,
      recoveryMs,
    })
  }

  public get phase(): DetectionPhase {
    return this._phase
  }

  public get isFlagged(): boolean {
    return this._phase === 'confirmed'
  }

  public get isWarning(): boolean {
    return this._phase === 'suspected'
  }

  public get isRecovering(): boolean {
    return this._phase === 'confirmed' && this.cleanSinceLastPositive
  }

  public get positiveCount(): number {
    return this.positives.length
  }

  public isStrong(obs: DetectionObservation): boolean {
    return (
      (obs.confidence ?? 1.0) >= this.strongConfidence ||
      (obs.agreeingSources ?? 1) >= 2
    )
  }

  public record(obs: DetectionObservation): DetectionTransition {
    if (obs.detected) {
      return this.recordPositive(obs)
    }
    return this.recordClean(obs)
  }

  private recordPositive(obs: DetectionObservation): DetectionTransition {
    this.positives.push(obs)
    this.lastPositiveAt = obs.at
    this.cleanSinceLastPositive = false
    this.prune(obs.at)

    // A positive while already confirmed simply extends the lock.
    if (this._phase === 'confirmed') {
      return 'none'
    }

    const strong = this.positives.filter(
      (p) =>
        this.isStrong(p) && obs.at - p.at <= this.strongConfirmWindowMs,
    ).length

    const weak = this.positives.filter(
      (p) => obs.at - p.at <= this.weakConfirmWindowMs,
    ).length

    if (
      strong >= this.strongConfirmPositives ||
      weak >= this.weakConfirmPositives
    ) {
      this._phase = 'confirmed'
      return 'confirmed'
    }

    if (this._phase === 'clear') {
      const inWindow = this.positives.filter(
        (p) => obs.at - p.at <= this.warningWindowMs,
      ).length
      if (inWindow >= this.warningPositives) {
        this._phase = 'suspected'
        return 'warning'
      }
    }

    return 'none'
  }

  private recordClean(obs: DetectionObservation): DetectionTransition {
    if (this._phase === 'confirmed') {
      this.cleanSinceLastPositive = true
      const last = this.lastPositiveAt
      if (last != null && obs.at - last >= this.recoveryMs) {
        this.reset()
        return 'resolved'
      }
      return 'none'
    }

    if (this._phase === 'suspected') {
      this.prune(obs.at)
      const stillRecent = this.positives.some(
        (p) => obs.at - p.at <= this.warningWindowMs,
      )
      if (!stillRecent) {
        this.reset()
        return 'warningCleared'
      }
    }

    return 'none'
  }

  private prune(now: number): void {
    const longest = Math.max(
      this.warningWindowMs,
      this.strongConfirmWindowMs,
      this.weakConfirmWindowMs,
    )
    this.positives = this.positives.filter((p) => now - p.at <= longest)
    while (this.positives.length > this.maxHistory) {
      this.positives.shift()
    }
  }

  public reset(): void {
    this.positives = []
    this._phase = 'clear'
    this.lastPositiveAt = null
    this.cleanSinceLastPositive = false
  }
}

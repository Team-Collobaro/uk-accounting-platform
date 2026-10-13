import { useCallback, useRef } from 'react'
import { DetectionIncident, IncidentType } from './types'

export interface ReporterOptions {
  sessionId?: string | null
  fetchFn?: typeof fetch
}

export class ProctorIncidentReporter {
  public sessionId?: string | null
  private pendingQueue: DetectionIncident[] = []
  private activeIncidents: Set<string> = new Set()
  private isFlushing: boolean = false
  private fetchFn: typeof fetch

  constructor(options: ReporterOptions = {}) {
    this.sessionId = options.sessionId
    this.fetchFn =
      options.fetchFn ??
      (typeof fetch !== 'undefined'
        ? fetch.bind(globalThis)
        : (() => Promise.resolve({ ok: false } as Response)))
  }

  public setSessionId(sessionId?: string | null) {
    this.sessionId = sessionId
  }

  public get activeIncidentKeys(): string[] {
    return Array.from(this.activeIncidents)
  }

  public get pendingQueueLength(): number {
    return this.pendingQueue.length
  }

  public async sendEvent(payload: {
    type: string
    severity?: string
    confidence?: number
    source: string
    description: string
    incidentKey?: string
    modelVersion?: string
    occurredAt?: string
    metadata?: Record<string, any>
  }): Promise<boolean> {
    if (!this.sessionId) return false

    try {
      const res = await this.fetchFn('/api/proctor-session/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: 1,
          sessionId: this.sessionId,
          ...payload,
        }),
      })
      return res.ok
    } catch (err) {
      console.warn('[proctor-reporter] Event send error:', err)
      return false
    }
  }

  public async flushQueue(): Promise<void> {
    if (this.isFlushing || this.pendingQueue.length === 0 || !this.sessionId) return
    this.isFlushing = true

    try {
      const remaining: DetectionIncident[] = []
      for (const incident of this.pendingQueue) {
        const success = await this.sendEvent({
          type: incident.type,
          severity: incident.severity,
          confidence: incident.confidence,
          source: incident.source,
          description: incident.description,
          incidentKey: incident.incidentKey,
          modelVersion: 'mediapipe-web-v1',
          occurredAt: incident.occurredAt,
          metadata: incident.metadata,
        })
        if (!success) {
          remaining.push(incident)
        }
      }
      this.pendingQueue = remaining.slice(-20)
    } finally {
      this.isFlushing = false
    }
  }

  public async reportIncident(incident: DetectionIncident): Promise<boolean> {
    if (!this.sessionId) return false

    // Deduplicate actively reported incident
    if (this.activeIncidents.has(incident.incidentKey)) {
      return false
    }
    this.activeIncidents.add(incident.incidentKey)

    const success = await this.sendEvent({
      type: incident.type,
      severity: incident.severity,
      confidence: incident.confidence,
      source: incident.source,
      description: incident.description,
      incidentKey: incident.incidentKey,
      modelVersion: 'mediapipe-web-v1',
      occurredAt: incident.occurredAt,
      metadata: incident.metadata,
    })

    if (!success) {
      if (!this.pendingQueue.some((i) => i.incidentKey === incident.incidentKey)) {
        if (this.pendingQueue.length >= 20) this.pendingQueue.shift()
        this.pendingQueue.push(incident)
      }
    }

    return success
  }

  public async resolveIncident(
    type: IncidentType | string,
    source: string = 'laptop_local',
    description?: string,
  ): Promise<boolean> {
    if (!this.sessionId) return false

    const primaryKey = `${source}:${type}`
    const alternateKey =
      source === 'laptop_local'
        ? `laptop:${type}`
        : source === 'mobile_local'
        ? `mobile:${type}`
        : primaryKey

    this.activeIncidents.delete(primaryKey)
    this.activeIncidents.delete(alternateKey)

    // Map resolution type for the backend
    let resolveType = 'clear'
    if (type === 'second_person') resolveType = 'second_person_cleared'
    else if (type === 'student_missing') resolveType = 'student_returned'
    else if (type === 'camera_stalled') resolveType = 'camera_stalled_cleared'
    else if (type === 'detector_unavailable') resolveType = 'detector_recovered'

    const success = await this.sendEvent({
      type: resolveType,
      source,
      description: description || `Incident ${type} resolved`,
      occurredAt: new Date().toISOString(),
    })

    void this.flushQueue()
    return success
  }
}

export function useProctorIncidentReporter({ sessionId }: { sessionId?: string | null }) {
  const reporterRef = useRef<ProctorIncidentReporter | null>(null)
  if (!reporterRef.current) {
    reporterRef.current = new ProctorIncidentReporter({ sessionId })
  } else {
    reporterRef.current.setSessionId(sessionId)
  }

  const reportIncident = useCallback(
    (incident: DetectionIncident) => reporterRef.current!.reportIncident(incident),
    [],
  )

  const resolveIncident = useCallback(
    (type: IncidentType | string, source?: string, description?: string) =>
      reporterRef.current!.resolveIncident(type, source, description),
    [],
  )

  const flushQueue = useCallback(() => reporterRef.current!.flushQueue(), [])

  return {
    reportIncident,
    resolveIncident,
    flushQueue,
  }
}

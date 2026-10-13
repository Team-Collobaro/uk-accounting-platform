import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProctorIncidentReporter } from './useProctorIncidentReporter'

describe('ProctorIncidentReporter', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sends incident event with correct payload structure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    const reporter = new ProctorIncidentReporter({ sessionId: 'sess-123', fetchFn: fetchMock as any })

    const success = await reporter.reportIncident({
      incidentKey: 'laptop:second_person',
      type: 'second_person',
      severity: 'hard',
      description: 'Second person in room',
      source: 'laptop_local',
      occurredAt: '2026-10-13T10:00:00Z',
    })

    expect(success).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/proctor-session/event')
    const body = JSON.parse(options.body)
    expect(body.sessionId).toBe('sess-123')
    expect(body.type).toBe('second_person')
    expect(body.severity).toBe('hard')
    expect(body.incidentKey).toBe('laptop:second_person')
  })

  it('deduplicates duplicate active incidents', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    const reporter = new ProctorIncidentReporter({ sessionId: 'sess-123', fetchFn: fetchMock as any })

    const incident = {
      incidentKey: 'laptop:second_person',
      type: 'second_person',
      severity: 'hard' as const,
      description: 'Second person in room',
      source: 'laptop_local',
      occurredAt: '2026-10-13T10:00:00Z',
    }

    const firstResult = await reporter.reportIncident(incident)
    const secondResult = await reporter.reportIncident(incident)

    expect(firstResult).toBe(true)
    expect(secondResult).toBe(false)
    // Only 1 network request made
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(reporter.activeIncidentKeys).toContain('laptop:second_person')
  })

  it('maps resolution event types correctly and removes active incident', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    const reporter = new ProctorIncidentReporter({ sessionId: 'sess-123', fetchFn: fetchMock as any })

    await reporter.reportIncident({
      incidentKey: 'laptop:second_person',
      type: 'second_person',
      severity: 'hard',
      description: 'Second person in room',
      source: 'laptop_local',
      occurredAt: '2026-10-13T10:00:00Z',
    })
    expect(reporter.activeIncidentKeys).toContain('laptop:second_person')

    await reporter.resolveIncident('second_person', 'laptop_local')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [, secondCallOptions] = fetchMock.mock.calls[1]
    const body = JSON.parse(secondCallOptions.body)
    expect(body.type).toBe('second_person_cleared')
    expect(body.source).toBe('laptop_local')
    expect(reporter.activeIncidentKeys).not.toContain('laptop:second_person')
  })

  it('queues incident for retry if network request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    const reporter = new ProctorIncidentReporter({ sessionId: 'sess-123', fetchFn: fetchMock as any })

    const result = await reporter.reportIncident({
      incidentKey: 'laptop:student_missing',
      type: 'student_missing',
      severity: 'hard',
      description: 'Student not visible',
      source: 'laptop_local',
      occurredAt: '2026-10-13T10:00:00Z',
    })

    expect(result).toBe(false)
    expect(reporter.pendingQueueLength).toBe(1)
  })
})

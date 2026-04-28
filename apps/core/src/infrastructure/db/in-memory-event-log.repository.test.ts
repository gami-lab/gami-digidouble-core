import { describe, expect, it } from 'vitest'
import { InMemoryEventLogRepository } from './in-memory-event-log.repository.js'

describe('InMemoryEventLogRepository', () => {
  it('findBySessionId returns session events newest-first and respects limit', async () => {
    const repository = new InMemoryEventLogRepository()

    await repository.append({
      sessionId: 'session_1',
      type: 'gm_skipped',
      severity: 'info',
      correlationId: 'corr-old',
      payload: { turnIndex: 1 },
    })
    await repository.append({
      sessionId: 'session_2',
      type: 'gm_skipped',
      severity: 'info',
      correlationId: 'corr-other',
      payload: { turnIndex: 1 },
    })
    await repository.append({
      sessionId: 'session_1',
      type: 'gm_triggered',
      severity: 'info',
      correlationId: 'corr-new',
      payload: { turnIndex: 2 },
    })

    const events = await repository.findBySessionId('session_1', { limit: 1 })

    expect(events).toHaveLength(1)
    expect(events[0]?.correlationId).toBe('corr-new')
    expect(events[0]?.createdAt).toEqual(expect.any(String))
  })

  it('getAll returns stored events with createdAt populated', async () => {
    const repository = new InMemoryEventLogRepository()

    await repository.append({
      type: 'gm_skipped',
      severity: 'info',
      payload: { turnIndex: 1 },
    })

    expect(repository.getAll()[0]?.createdAt).toEqual(expect.any(String))
  })
})

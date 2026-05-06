import { describe, expect, it } from 'vitest'
import { InMemorySessionMemoryRepository } from './in-memory-session-memory.repository.js'

describe('InMemorySessionMemoryRepository', () => {
  it('returns null for unknown session', async () => {
    const repository = new InMemorySessionMemoryRepository()

    await expect(repository.findBySessionId('session_missing')).resolves.toBeNull()
  })

  it('upsert inserts and then updates the same session memory row', async () => {
    const repository = new InMemorySessionMemoryRepository()

    const created = await repository.upsert({
      sessionId: 'session_1',
      summary: 'First summary',
    })

    const updated = await repository.upsert({
      sessionId: 'session_1',
      summary: 'Updated summary',
    })

    expect(updated.sessionId).toBe('session_1')
    expect(updated.summary).toBe('Updated summary')
    expect(Date.parse(updated.updatedAt)).toBeGreaterThanOrEqual(Date.parse(created.updatedAt))
  })

  it('deleteBySessionId removes only the targeted session memory', async () => {
    const repository = new InMemorySessionMemoryRepository([
      {
        sessionId: 'session_1',
        summary: 'One',
        updatedAt: '2026-05-06T08:00:00.000Z',
      },
      {
        sessionId: 'session_2',
        summary: 'Two',
        updatedAt: '2026-05-06T08:00:00.000Z',
      },
    ])

    await expect(repository.deleteBySessionId('session_1')).resolves.toBe(true)
    await expect(repository.findBySessionId('session_1')).resolves.toBeNull()
    await expect(repository.findBySessionId('session_2')).resolves.toMatchObject({ summary: 'Two' })
  })
})

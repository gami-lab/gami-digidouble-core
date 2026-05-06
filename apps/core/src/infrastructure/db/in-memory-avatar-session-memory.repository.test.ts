import { describe, expect, it } from 'vitest'
import { InMemoryAvatarSessionMemoryRepository } from './in-memory-avatar-session-memory.repository.js'

describe('InMemoryAvatarSessionMemoryRepository', () => {
  it('returns null for unknown session/avatar pair', async () => {
    const repository = new InMemoryAvatarSessionMemoryRepository()

    await expect(
      repository.findBySessionIdAndAvatarId('session_missing', 'avatar_missing'),
    ).resolves.toBeNull()
  })

  it('upsert inserts and then updates only the targeted avatar row', async () => {
    const repository = new InMemoryAvatarSessionMemoryRepository()

    const created = await repository.upsert({
      sessionId: 'session_1',
      avatarId: 'avatar_1',
      summary: 'Avatar one summary',
    })

    const updated = await repository.upsert({
      sessionId: 'session_1',
      avatarId: 'avatar_1',
      summary: 'Avatar one summary updated',
    })

    expect(updated.summary).toBe('Avatar one summary updated')
    expect(Date.parse(updated.updatedAt)).toBeGreaterThanOrEqual(Date.parse(created.updatedAt))
  })

  it('isolates memory by avatar within the same session', async () => {
    const repository = new InMemoryAvatarSessionMemoryRepository()

    await repository.upsert({ sessionId: 'session_1', avatarId: 'avatar_1', summary: 'A1' })
    await repository.upsert({ sessionId: 'session_1', avatarId: 'avatar_2', summary: 'A2' })

    await expect(
      repository.findBySessionIdAndAvatarId('session_1', 'avatar_1'),
    ).resolves.toMatchObject({
      summary: 'A1',
    })
    await expect(
      repository.findBySessionIdAndAvatarId('session_1', 'avatar_2'),
    ).resolves.toMatchObject({
      summary: 'A2',
    })
  })

  it('deleteBySessionId removes all avatar memories for the session only', async () => {
    const repository = new InMemoryAvatarSessionMemoryRepository([
      {
        sessionId: 'session_1',
        avatarId: 'avatar_1',
        summary: 'S1/A1',
        updatedAt: '2026-05-06T08:00:00.000Z',
      },
      {
        sessionId: 'session_1',
        avatarId: 'avatar_2',
        summary: 'S1/A2',
        updatedAt: '2026-05-06T08:00:00.000Z',
      },
      {
        sessionId: 'session_2',
        avatarId: 'avatar_1',
        summary: 'S2/A1',
        updatedAt: '2026-05-06T08:00:00.000Z',
      },
    ])

    await expect(repository.deleteBySessionId('session_1')).resolves.toBe(2)
    await expect(repository.findBySessionIdAndAvatarId('session_1', 'avatar_1')).resolves.toBeNull()
    await expect(repository.findBySessionIdAndAvatarId('session_1', 'avatar_2')).resolves.toBeNull()
    await expect(
      repository.findBySessionIdAndAvatarId('session_2', 'avatar_1'),
    ).resolves.toMatchObject({
      summary: 'S2/A1',
    })
  })
})

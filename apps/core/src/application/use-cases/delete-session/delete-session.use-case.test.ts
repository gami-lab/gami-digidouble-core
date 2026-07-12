import { describe, expect, it } from 'vitest'
import { InMemorySessionRepository } from '../../../infrastructure/db/in-memory-session.repository.js'
import { DeleteSessionUseCase } from './delete-session.use-case.js'

describe('DeleteSessionUseCase', () => {
  it('returns 404 when session is missing', async () => {
    const useCase = new DeleteSessionUseCase(new InMemorySessionRepository())

    await expect(useCase.execute({ sessionId: 'session_missing' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('deletes an existing session', async () => {
    const sessionRepository = new InMemorySessionRepository([
      {
        sessionId: 'session_1',
        userId: 'user_1',
        scenarioId: 'scenario_1',
        status: 'closed',
        startedAt: '2026-04-21T08:00:00.000Z',
        lastActivityAt: '2026-04-21T08:00:00.000Z',
        endedAt: '2026-04-21T08:30:00.000Z',
      },
    ])
    const useCase = new DeleteSessionUseCase(sessionRepository)

    const result = await useCase.execute({ sessionId: 'session_1' })

    expect(result).toEqual({ sessionId: 'session_1', deleted: true })
    await expect(sessionRepository.findById('session_1')).resolves.toBeNull()
  })
})

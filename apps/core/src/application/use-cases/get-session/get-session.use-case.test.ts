import { describe, expect, it } from 'vitest'
import type { Session } from '../../../domain/conversation/session.types.js'
import { DomainError } from '../../../domain/errors.js'
import { InMemorySessionRepository } from '../../../infrastructure/db/in-memory-session.repository.js'
import { GetSessionUseCase } from './get-session.use-case.js'

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    activeAvatarId: 'avatar_1',
    unlockedAvatarIds: ['avatar_1', 'avatar_2'],
    status: 'active',
    startedAt: '2026-05-01T10:00:00.000Z',
    lastActivityAt: '2026-05-01T10:10:00.000Z',
    endedAt: '2026-05-01T10:11:00.000Z',
    ...overrides,
  }
}

describe('GetSessionUseCase', () => {
  it('returns the full session summary with optional fields when present', async () => {
    const useCase = new GetSessionUseCase(new InMemorySessionRepository([makeSession()]))

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.session).toEqual({
      sessionId: 'session_1',
      userId: 'user_1',
      scenarioId: 'scenario_1',
      activeAvatarId: 'avatar_1',
      unlockedAvatarIds: ['avatar_1', 'avatar_2'],
      status: 'active',
      startedAt: '2026-05-01T10:00:00.000Z',
      lastActivityAt: '2026-05-01T10:10:00.000Z',
      endedAt: '2026-05-01T10:11:00.000Z',
    })
  })

  it('omits optional fields when they are absent', async () => {
    const sessionWithoutOptionals = makeSession()
    delete sessionWithoutOptionals.activeAvatarId
    delete sessionWithoutOptionals.unlockedAvatarIds
    delete sessionWithoutOptionals.endedAt

    const useCase = new GetSessionUseCase(new InMemorySessionRepository([sessionWithoutOptionals]))

    const output = await useCase.execute({ sessionId: 'session_1' })

    expect(output.session.activeAvatarId).toBeUndefined()
    expect(output.session.unlockedAvatarIds).toBeUndefined()
    expect(output.session.endedAt).toBeUndefined()
  })

  it('throws NOT_FOUND when the session does not exist', async () => {
    const useCase = new GetSessionUseCase(new InMemorySessionRepository([]))

    await expect(useCase.execute({ sessionId: 'missing' })).rejects.toEqual(
      new DomainError('NOT_FOUND', 'Session missing was not found.'),
    )
  })
})

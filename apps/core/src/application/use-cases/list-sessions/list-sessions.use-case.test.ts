import { describe, expect, it } from 'vitest'
import type { Session } from '../../../domain/conversation/session.types.js'
import { InMemorySessionRepository } from '../../../infrastructure/db/in-memory-session.repository.js'
import { ListSessionsUseCase } from './list-sessions.use-case.js'

function makeSession(overrides: Partial<Session> & Pick<Session, 'sessionId'>): Session {
  return {
    userId: 'user_1',
    scenarioId: 'scenario_1',
    status: 'active',
    startedAt: '2026-04-21T08:00:00.000Z',
    lastActivityAt: '2026-04-21T08:00:00.000Z',
    ...overrides,
  }
}

describe('ListSessionsUseCase', () => {
  it('returns all sessions when no filter is provided', async () => {
    const repository = new InMemorySessionRepository([
      makeSession({ sessionId: 'session_1' }),
      makeSession({ sessionId: 'session_2' }),
    ])
    const useCase = new ListSessionsUseCase(repository)

    const result = await useCase.execute({})

    expect(result.sessions).toHaveLength(2)
  })

  it('returns empty array when no sessions exist', async () => {
    const useCase = new ListSessionsUseCase(new InMemorySessionRepository())

    const result = await useCase.execute({})

    expect(result.sessions).toEqual([])
  })

  it('filters by scenarioId', async () => {
    const repository = new InMemorySessionRepository([
      makeSession({ sessionId: 'session_1', scenarioId: 'scenario_A' }),
      makeSession({ sessionId: 'session_2', scenarioId: 'scenario_B' }),
    ])
    const useCase = new ListSessionsUseCase(repository)

    const result = await useCase.execute({ scenarioId: 'scenario_A' })

    expect(result.sessions).toHaveLength(1)
    expect(result.sessions[0]?.sessionId).toBe('session_1')
  })

  it('filters by userId', async () => {
    const repository = new InMemorySessionRepository([
      makeSession({ sessionId: 'session_1', userId: 'user_Alice' }),
      makeSession({ sessionId: 'session_2', userId: 'user_Bob' }),
    ])
    const useCase = new ListSessionsUseCase(repository)

    const result = await useCase.execute({ userId: 'user_Alice' })

    expect(result.sessions).toHaveLength(1)
    expect(result.sessions[0]?.sessionId).toBe('session_1')
  })

  it('filters by status', async () => {
    const repository = new InMemorySessionRepository([
      makeSession({ sessionId: 'session_1', status: 'active' }),
      makeSession({ sessionId: 'session_2', status: 'closed' }),
    ])
    const useCase = new ListSessionsUseCase(repository)

    const result = await useCase.execute({ status: 'active' })

    expect(result.sessions).toHaveLength(1)
    expect(result.sessions[0]?.sessionId).toBe('session_1')
  })

  it('returns sessions ordered by lastActivityAt DESC', async () => {
    const repository = new InMemorySessionRepository([
      makeSession({ sessionId: 'session_old', lastActivityAt: '2026-04-21T08:00:00.000Z' }),
      makeSession({ sessionId: 'session_new', lastActivityAt: '2026-04-21T10:00:00.000Z' }),
    ])
    const useCase = new ListSessionsUseCase(repository)

    const result = await useCase.execute({})

    expect(result.sessions.map((s) => s.sessionId)).toEqual(['session_new', 'session_old'])
  })
})

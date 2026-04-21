import { describe, expect, it } from 'vitest'
import type { Session } from '../../domain/conversation/session.types.js'
import { InMemorySessionRepository } from './in-memory-session.repository.js'

function makeSession(overrides: Partial<Session>): Session {
  return {
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    status: 'active',
    startedAt: '2026-04-21T08:00:00.000Z',
    lastActivityAt: '2026-04-21T08:00:00.000Z',
    ...overrides,
  }
}

describe('InMemorySessionRepository', () => {
  it('countByScenarioId returns all sessions for scenario', async () => {
    const repository = new InMemorySessionRepository([
      makeSession({ sessionId: 'session_1', scenarioId: 'scenario_1', status: 'active' }),
      makeSession({ sessionId: 'session_2', scenarioId: 'scenario_1', status: 'closed' }),
      makeSession({ sessionId: 'session_3', scenarioId: 'scenario_2', status: 'active' }),
    ])

    const count = await repository.countByScenarioId('scenario_1')

    expect(count).toBe(2)
  })

  it('countActiveByScenarioId returns active sessions only', async () => {
    const repository = new InMemorySessionRepository([
      makeSession({ sessionId: 'session_1', scenarioId: 'scenario_1', status: 'active' }),
      makeSession({ sessionId: 'session_2', scenarioId: 'scenario_1', status: 'closed' }),
    ])

    const count = await repository.countActiveByScenarioId('scenario_1')

    expect(count).toBe(1)
  })
})

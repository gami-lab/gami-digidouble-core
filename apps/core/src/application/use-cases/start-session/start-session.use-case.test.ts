import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '../../../domain/conversation/session.types.js'
import type { DomainError } from '../../../domain/errors.js'
import { StartSessionUseCase } from './start-session.use-case.js'

const createSessionMock = vi.fn()

const sessionRepository = {
  findById: vi.fn(),
  create: createSessionMock,
  update: vi.fn(),
  delete: vi.fn(),
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    status: 'active',
    startedAt: '2026-04-19T10:00:00.000Z',
    lastActivityAt: '2026-04-19T10:00:00.000Z',

    ...overrides,
  }
}

beforeEach(() => {
  createSessionMock.mockReset()
  createSessionMock.mockResolvedValue(makeSession())
})

describe('StartSessionUseCase', () => {
  it('throws VALIDATION_ERROR for blank userId', async () => {
    const useCase = new StartSessionUseCase(sessionRepository)

    await expect(useCase.execute({ userId: ' ', scenarioId: 'scenario_1' })).rejects.toEqual(
      expect.objectContaining<Partial<DomainError>>({ code: 'VALIDATION_ERROR' }),
    )
  })

  it('throws VALIDATION_ERROR for blank scenarioId', async () => {
    const useCase = new StartSessionUseCase(sessionRepository)

    await expect(useCase.execute({ userId: 'user_1', scenarioId: ' ' })).rejects.toEqual(
      expect.objectContaining<Partial<DomainError>>({ code: 'VALIDATION_ERROR' }),
    )
  })

  it("creates and returns an 'active' session for valid input", async () => {
    const useCase = new StartSessionUseCase(sessionRepository)
    createSessionMock.mockResolvedValue(
      makeSession({
        sessionId: 'session_abc',
        userId: 'user_abc',
        scenarioId: 'scenario_abc',
        status: 'active',
      }),
    )

    const output = await useCase.execute({
      userId: '  user_abc  ',
      scenarioId: '  scenario_abc  ',
    })

    expect(createSessionMock).toHaveBeenCalledWith({
      userId: 'user_abc',
      scenarioId: 'scenario_abc',
    })
    expect(output.session).toMatchObject({
      sessionId: 'session_abc',
      userId: 'user_abc',
      scenarioId: 'scenario_abc',
      status: 'active',
    })
  })
})

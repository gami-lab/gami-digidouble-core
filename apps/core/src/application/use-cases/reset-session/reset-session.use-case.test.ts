import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '../../../domain/conversation/session.types.js'
import type { DomainError } from '../../../domain/errors.js'
import { ResetSessionUseCase } from './reset-session.use-case.js'

const findSessionByIdMock = vi.fn()
const deleteBySessionIdMock = vi.fn()
const deleteSessionMock = vi.fn()

const sessionRepository = {
  findById: findSessionByIdMock,
  create: vi.fn(),
  update: vi.fn(),
  delete: deleteSessionMock,
}

const messageRepository = {
  findBySessionId: vi.fn(),
  save: vi.fn(),
  deleteBySessionId: deleteBySessionIdMock,
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    sessionId: 'sess_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    status: 'active',
    startedAt: '2026-04-19T10:00:00.000Z',
    lastActivityAt: '2026-04-19T10:00:00.000Z',

    ...overrides,
  }
}

beforeEach(() => {
  findSessionByIdMock.mockReset()
  deleteBySessionIdMock.mockReset()
  deleteSessionMock.mockReset()
  findSessionByIdMock.mockResolvedValue(makeSession())
  deleteBySessionIdMock.mockResolvedValue(0)
})

describe('ResetSessionUseCase', () => {
  it('throws NOT_FOUND when session does not exist', async () => {
    const useCase = new ResetSessionUseCase(sessionRepository, messageRepository)
    findSessionByIdMock.mockResolvedValue(null)

    await expect(useCase.execute({ sessionId: 'missing' })).rejects.toEqual(
      expect.objectContaining<Partial<DomainError>>({ code: 'NOT_FOUND' }),
    )
  })

  it('deletes messages and preserves session record', async () => {
    const useCase = new ResetSessionUseCase(sessionRepository, messageRepository)
    deleteBySessionIdMock.mockResolvedValue(3)

    const output = await useCase.execute({ sessionId: 'sess_1' })

    expect(deleteBySessionIdMock).toHaveBeenCalledWith('sess_1')
    expect(deleteSessionMock).not.toHaveBeenCalled()
    expect(output).toEqual({
      sessionId: 'sess_1',
      deleted: {
        messages: 3,
        sessionMemory: false,
        events: 0,
      },
    })
  })
})

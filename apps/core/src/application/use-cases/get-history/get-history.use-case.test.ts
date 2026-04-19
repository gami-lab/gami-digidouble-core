import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Message, Session } from '../../../domain/conversation/session.types.js'
import type { DomainError } from '../../../domain/errors.js'
import { GetHistoryUseCase } from './get-history.use-case.js'

const findSessionByIdMock = vi.fn()
const findMessagesBySessionIdMock = vi.fn()

const sessionRepository = {
  findById: findSessionByIdMock,
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

const messageRepository = {
  findBySessionId: findMessagesBySessionIdMock,
  save: vi.fn(),
  deleteBySessionId: vi.fn(),
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    sessionId: 'sess_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    status: 'active',
    startedAt: '2026-04-19T10:00:00.000Z',
    lastActivityAt: '2026-04-19T10:00:00.000Z',
    endedAt: null,
    ...overrides,
  }
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    messageId: 'msg_1',
    sessionId: 'sess_1',
    role: 'user',
    content: 'hello',
    createdAt: '2026-04-19T10:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  findSessionByIdMock.mockReset()
  findMessagesBySessionIdMock.mockReset()
  findSessionByIdMock.mockResolvedValue(makeSession())
  findMessagesBySessionIdMock.mockResolvedValue([])
})

describe('GetHistoryUseCase', () => {
  it('throws NOT_FOUND when session does not exist', async () => {
    const useCase = new GetHistoryUseCase(sessionRepository, messageRepository)
    findSessionByIdMock.mockResolvedValue(null)

    await expect(useCase.execute({ sessionId: 'missing' })).rejects.toEqual(
      expect.objectContaining<Partial<DomainError>>({ code: 'NOT_FOUND' }),
    )
  })

  it('returns session with empty messages when no messages exist', async () => {
    const useCase = new GetHistoryUseCase(sessionRepository, messageRepository)

    const output = await useCase.execute({ sessionId: 'sess_1' })

    expect(output.session.sessionId).toBe('sess_1')
    expect(output.messages).toEqual([])
  })

  it('returns messages sorted by createdAt from repository output', async () => {
    const useCase = new GetHistoryUseCase(sessionRepository, messageRepository)
    const sortedMessages = [
      makeMessage({ messageId: 'msg_1', createdAt: '2026-04-19T10:00:01.000Z', content: 'first' }),
      makeMessage({
        messageId: 'msg_2',
        role: 'avatar',
        createdAt: '2026-04-19T10:00:02.000Z',
        content: 'second',
      }),
    ]
    findMessagesBySessionIdMock.mockResolvedValue(sortedMessages)

    const output = await useCase.execute({ sessionId: 'sess_1' })

    expect(output.messages).toEqual(sortedMessages)
    expect(output.messages.map((message) => message.createdAt)).toEqual([
      '2026-04-19T10:00:01.000Z',
      '2026-04-19T10:00:02.000Z',
    ])
  })
})

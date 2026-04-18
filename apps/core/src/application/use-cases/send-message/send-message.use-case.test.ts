import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { Message, Session } from '../../../domain/conversation/session.types.js'
import { DomainError } from '../../../domain/errors.js'
import { LlmError } from '../../../infrastructure/llm/llm.error.js'
import { expectConsoleError } from '../../../test-utils/console.js'
import type { LlmRequest } from '../../ports/ILlmAdapter.js'
import type { LlmResponse } from '../../ports/ILlmAdapter.js'
import { SendMessageUseCase } from './send-message.use-case.js'

const findSessionByIdMock = vi.fn()
const findAvatarByIdMock = vi.fn()
const findMessagesBySessionIdMock = vi.fn()
const saveMessageMock = vi.fn()
const completeMock = vi.fn()
const traceMock = vi.fn()
const flushMock = vi.fn()

const sessionRepository = {
  findById: findSessionByIdMock,
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}
const avatarRepository = { findById: findAvatarByIdMock }
const messageRepository = { findBySessionId: findMessagesBySessionIdMock, save: saveMessageMock }
const llm = { complete: completeMock }
const observability = { trace: traceMock, flush: flushMock }

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    sessionId: 'sess_1',
    userId: 'user_1',
    scenarioId: 'scn_1',
    status: 'active',
    startedAt: '2026-04-18T10:00:00.000Z',
    lastActivityAt: '2026-04-18T10:00:00.000Z',
    endedAt: null,
    ...overrides,
  }
}

function makeAvatar(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    avatarId: 'ava_1',
    scenarioId: 'scn_1',
    name: 'Ava',
    slug: 'ava',
    status: 'active',
    personaPrompt: 'You are Ava, a helpful guide.',
    tone: 'friendly',
    ...overrides,
  }
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    messageId: 'msg_prev',
    sessionId: 'sess_1',
    role: 'user',
    content: 'Earlier message',
    createdAt: '2026-04-18T10:00:00.000Z',
    ...overrides,
  }
}

function makeLlmResponse(overrides: Partial<LlmResponse> = {}): LlmResponse {
  return {
    content: 'Avatar reply',
    model: 'null',
    inputTokens: 11,
    outputTokens: 17,
    latencyMs: 30,
    ...overrides,
  }
}

function createUseCase(): SendMessageUseCase {
  return new SendMessageUseCase(
    sessionRepository,
    avatarRepository,
    messageRepository,
    llm,
    observability,
  )
}

function getSavedMessageCall(index: number): Message {
  return saveMessageMock.mock.calls[index]?.[0] as Message
}

function getLlmRequestCall(index: number): LlmRequest {
  return completeMock.mock.calls[index]?.[0] as LlmRequest
}

beforeEach(() => {
  findSessionByIdMock.mockReset()
  findAvatarByIdMock.mockReset()
  findMessagesBySessionIdMock.mockReset()
  saveMessageMock.mockReset()
  completeMock.mockReset()
  traceMock.mockReset()
  flushMock.mockReset()

  findSessionByIdMock.mockResolvedValue(makeSession())
  findAvatarByIdMock.mockResolvedValue(makeAvatar())
  findMessagesBySessionIdMock.mockResolvedValue([])
  saveMessageMock.mockImplementation((message: Message) => Promise.resolve(message))
  completeMock.mockResolvedValue(makeLlmResponse())
  traceMock.mockResolvedValue(undefined)
  flushMock.mockResolvedValue(undefined)
})

describe('SendMessageUseCase - conversation flow', () => {
  it('persists user/avatar messages and returns a valid output on the happy path', async () => {
    const useCase = createUseCase()

    const output = await useCase.execute({
      sessionId: 'sess_1',
      avatarId: 'ava_1',
      userMessage: 'Hello avatar',
    })

    expect(output.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(output.sessionId).toBe('sess_1')
    expect(output.userMessage.messageId).toMatch(/^msg_/)
    expect(output.userMessage.content).toBe('Hello avatar')
    expect(output.avatarMessage.content).toBe('Avatar reply')
    expect(output.avatarMessage.model).toBe('null')
    expect(output.avatarMessage.inputTokens).toBe(11)
    expect(output.avatarMessage.outputTokens).toBe(17)
    expect(output.avatarMessage.latencyMs).toBe(30)

    expect(findMessagesBySessionIdMock).toHaveBeenCalledWith('sess_1', { limit: 20 })
    expect(saveMessageMock).toHaveBeenCalledTimes(2)
    expect(getSavedMessageCall(0).role).toBe('user')
    expect(getSavedMessageCall(1).role).toBe('avatar')
    expect(getSavedMessageCall(1).metadata).toEqual({
      model: 'null',
      latencyMs: 30,
      inputTokens: 11,
      outputTokens: 17,
      totalTokens: 28,
    })
  })

  it('persists the user message before the LLM call', async () => {
    const useCase = createUseCase()

    await useCase.execute({
      sessionId: 'sess_1',
      avatarId: 'ava_1',
      userMessage: 'Hello avatar',
    })

    const userSaveOrder = saveMessageMock.mock.invocationCallOrder[0]
    const llmOrder = completeMock.mock.invocationCallOrder[0]
    if (userSaveOrder === undefined || llmOrder === undefined) {
      throw new Error('Expected save and llm calls to be recorded.')
    }
    expect(userSaveOrder).toBeLessThan(llmOrder)
  })

  it('throws DomainError NOT_FOUND when session does not exist', async () => {
    const useCase = createUseCase()
    findSessionByIdMock.mockResolvedValue(null)

    await expect(
      useCase.execute({ sessionId: 'missing', avatarId: 'ava_1', userMessage: 'Hello' }),
    ).rejects.toEqual(expect.objectContaining<Partial<DomainError>>({ code: 'NOT_FOUND' }))
  })

  it('throws DomainError CONFLICT when session is closed', async () => {
    const useCase = createUseCase()
    findSessionByIdMock.mockResolvedValue(makeSession({ status: 'closed' }))

    await expect(
      useCase.execute({ sessionId: 'sess_1', avatarId: 'ava_1', userMessage: 'Hello' }),
    ).rejects.toEqual(expect.objectContaining<Partial<DomainError>>({ code: 'CONFLICT' }))
  })

  it('throws DomainError NOT_FOUND when avatar does not exist', async () => {
    const useCase = createUseCase()
    findAvatarByIdMock.mockResolvedValue(null)

    await expect(
      useCase.execute({ sessionId: 'sess_1', avatarId: 'missing', userMessage: 'Hello' }),
    ).rejects.toEqual(expect.objectContaining<Partial<DomainError>>({ code: 'NOT_FOUND' }))
  })

  it('passes history to the LLM in chronological order', async () => {
    const useCase = createUseCase()
    findMessagesBySessionIdMock.mockResolvedValue([
      makeMessage({
        messageId: 'msg_2',
        role: 'avatar',
        content: 'Second',
        createdAt: '2026-04-18T10:00:02.000Z',
      }),
      makeMessage({
        messageId: 'msg_1',
        role: 'user',
        content: 'First',
        createdAt: '2026-04-18T10:00:01.000Z',
      }),
      makeMessage({
        messageId: 'msg_3',
        role: 'system',
        content: 'Third',
        createdAt: '2026-04-18T10:00:03.000Z',
      }),
    ])

    await useCase.execute({ sessionId: 'sess_1', avatarId: 'ava_1', userMessage: 'Latest' })

    const llmArg = getLlmRequestCall(0)
    expect(llmArg.messages).toEqual([
      { role: 'user', content: 'First' },
      { role: 'assistant', content: 'Second' },
      { role: 'assistant', content: 'Third' },
      { role: 'user', content: 'Latest' },
    ])
  })
})

describe('SendMessageUseCase - error and observability handling', () => {
  it('propagates LlmError unchanged', async () => {
    const useCase = createUseCase()
    const llmError = new LlmError('openai', 'provider failed', 500)
    completeMock.mockRejectedValue(llmError)

    await expect(
      useCase.execute({ sessionId: 'sess_1', avatarId: 'ava_1', userMessage: 'Hello' }),
    ).rejects.toBe(llmError)
  })

  it('swallows observability trace failures', async () => {
    const useCase = createUseCase()
    traceMock.mockRejectedValue(new Error('Langfuse down'))

    const result = await expectConsoleError(
      () => useCase.execute({ sessionId: 'sess_1', avatarId: 'ava_1', userMessage: 'Hello' }),
      /Observability trace failed.*Langfuse down/,
    )
    expect(result).toBeDefined()
  })
})

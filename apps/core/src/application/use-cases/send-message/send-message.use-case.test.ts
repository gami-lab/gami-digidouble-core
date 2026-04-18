import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { Message, Session } from '../../../domain/conversation/session.types.js'
import type { DomainError } from '../../../domain/errors.js'
import { LlmError } from '../../../infrastructure/llm/llm.error.js'
import { expectConsoleError } from '../../../test-utils/console.js'
import type { LlmRequest, LlmResponse } from '../../ports/ILlmAdapter.js'
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

describe('SendMessageUseCase -> session validation', () => {
  it('throws NOT_FOUND when session does not exist', async () => {
    const useCase = createUseCase()
    findSessionByIdMock.mockResolvedValue(null)

    await expect(
      useCase.execute({ sessionId: 'missing', avatarId: 'ava_1', userMessage: 'Hello' }),
    ).rejects.toEqual(expect.objectContaining<Partial<DomainError>>({ code: 'NOT_FOUND' }))
  })

  it('throws CONFLICT when session is closed', async () => {
    const useCase = createUseCase()
    findSessionByIdMock.mockResolvedValue(makeSession({ status: 'closed' }))

    await expect(
      useCase.execute({ sessionId: 'sess_1', avatarId: 'ava_1', userMessage: 'Hello' }),
    ).rejects.toEqual(expect.objectContaining<Partial<DomainError>>({ code: 'CONFLICT' }))
  })

  it('throws CONFLICT when session is archived', async () => {
    const useCase = createUseCase()
    findSessionByIdMock.mockResolvedValue(makeSession({ status: 'archived' }))

    await expect(
      useCase.execute({ sessionId: 'sess_1', avatarId: 'ava_1', userMessage: 'Hello' }),
    ).rejects.toEqual(expect.objectContaining<Partial<DomainError>>({ code: 'CONFLICT' }))
  })
})

describe('SendMessageUseCase -> avatar loading', () => {
  it('throws NOT_FOUND when avatar does not exist', async () => {
    const useCase = createUseCase()
    findAvatarByIdMock.mockResolvedValue(null)

    await expect(
      useCase.execute({ sessionId: 'sess_1', avatarId: 'missing', userMessage: 'Hello' }),
    ).rejects.toEqual(expect.objectContaining<Partial<DomainError>>({ code: 'NOT_FOUND' }))
  })
})

describe('SendMessageUseCase -> prompt assembly', () => {
  it('uses assembled persona prompt as LLM system prompt', async () => {
    const useCase = createUseCase()
    findAvatarByIdMock.mockResolvedValue(
      makeAvatar({
        name: 'Nova',
        personaPrompt: 'You are the scenario librarian.',
        tone: 'calm and precise',
      }),
    )

    await useCase.execute({ sessionId: 'sess_1', avatarId: 'ava_1', userMessage: 'Hello' })

    expect(getLlmRequestCall(0).systemPrompt).toBe(
      'You are the scenario librarian.\n\nYour name is Nova.\n\nYour tone is calm and precise.\n\nStay in character and keep responses concise.',
    )
  })
})

describe('SendMessageUseCase -> message history', () => {
  it('assembles multi-turn history in chronological order and forwards it to LLM', async () => {
    const useCase = createUseCase()
    findMessagesBySessionIdMock.mockResolvedValue([
      makeMessage({
        messageId: 'msg_avatar',
        role: 'avatar',
        content: 'Second',
        createdAt: '2026-04-18T10:00:02.000Z',
      }),
      makeMessage({
        messageId: 'msg_user',
        role: 'user',
        content: 'First',
        createdAt: '2026-04-18T10:00:01.000Z',
      }),
      makeMessage({
        messageId: 'msg_system',
        role: 'system',
        content: 'Ignored',
        createdAt: '2026-04-18T10:00:03.000Z',
      }),
    ])

    await useCase.execute({ sessionId: 'sess_1', avatarId: 'ava_1', userMessage: 'Latest' })

    expect(getLlmRequestCall(0).messages).toEqual([
      { role: 'user', content: 'First' },
      { role: 'assistant', content: 'Second' },
      { role: 'user', content: 'Latest' },
    ])
  })

  it('truncates history to the 20 most recent items before adding the new user turn', async () => {
    const useCase = createUseCase()
    const longHistory = Array.from({ length: 25 }, (_, index) =>
      makeMessage({
        messageId: `msg_${String(index + 1)}`,
        role: index % 2 === 0 ? 'user' : 'avatar',
        content: `Turn ${String(index + 1)}`,
        createdAt: `2026-04-18T10:${String(index).padStart(2, '0')}:00.000Z`,
      }),
    )
    findMessagesBySessionIdMock.mockResolvedValue(longHistory)

    await useCase.execute({ sessionId: 'sess_1', avatarId: 'ava_1', userMessage: 'Latest' })

    expect(findMessagesBySessionIdMock).toHaveBeenCalledWith('sess_1', { limit: 20 })
    const historyInLlm = getLlmRequestCall(0).messages.slice(0, -1)
    expect(historyInLlm).toHaveLength(20)
    expect(historyInLlm[0]?.content).toBe('Turn 6')
    expect(historyInLlm[19]?.content).toBe('Turn 25')
  })
})

describe('SendMessageUseCase -> message persistence', () => {
  it('persists user message before LLM call and avatar message after LLM call', async () => {
    const useCase = createUseCase()

    await useCase.execute({ sessionId: 'sess_1', avatarId: 'ava_1', userMessage: 'Hello avatar' })

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

    const userSaveOrder = saveMessageMock.mock.invocationCallOrder[0]
    const llmOrder = completeMock.mock.invocationCallOrder[0]
    const avatarSaveOrder = saveMessageMock.mock.invocationCallOrder[1]
    if (userSaveOrder === undefined || llmOrder === undefined || avatarSaveOrder === undefined) {
      throw new Error('Expected save and llm calls to be recorded.')
    }
    expect(userSaveOrder).toBeLessThan(llmOrder)
    expect(avatarSaveOrder).toBeGreaterThan(llmOrder)
  })
})

describe('SendMessageUseCase -> observability', () => {
  it('fires trace with completion payload and latency metadata', async () => {
    const useCase = createUseCase()

    const output = await useCase.execute({
      sessionId: 'sess_1',
      avatarId: 'ava_1',
      userMessage: 'Hello avatar',
    })

    expect(output.sessionId).toBe('sess_1')
    expect(traceMock).toHaveBeenCalledTimes(1)
    expect(traceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: output.requestId,
        sessionId: 'sess_1',
        event: 'llm.completion',
        output: 'Avatar reply',
        inputTokens: 11,
        outputTokens: 17,
        metadata: { model: 'null' },
      }),
    )
  })

  it('swallows observability trace failures', async () => {
    const useCase = createUseCase()
    traceMock.mockRejectedValue(new Error('Langfuse down'))

    const result = await expectConsoleError(
      () => useCase.execute({ sessionId: 'sess_1', avatarId: 'ava_1', userMessage: 'Hello' }),
      /Observability trace failed.*Langfuse down/,
    )

    expect(result.avatarMessage.content).toBe('Avatar reply')
  })
})

describe('SendMessageUseCase -> error propagation', () => {
  it('propagates LlmError unchanged', async () => {
    const useCase = createUseCase()
    const llmError = new LlmError('openai', 'provider failed', 500)
    completeMock.mockRejectedValue(llmError)

    await expect(
      useCase.execute({ sessionId: 'sess_1', avatarId: 'ava_1', userMessage: 'Hello' }),
    ).rejects.toBe(llmError)
  })
})

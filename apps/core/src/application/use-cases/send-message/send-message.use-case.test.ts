import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { Conversation, Message, Session } from '../../../domain/conversation/session.types.js'
import { SendMessageUseCase } from './send-message.use-case.js'

const findSessionByIdMock = vi.fn()
const updateSessionMock = vi.fn()
const findConversationByIdMock = vi.fn()
const updateConversationMock = vi.fn()
const findAvatarByIdMock = vi.fn()
const findMessagesByConversationIdMock = vi.fn()
const saveMessageMock = vi.fn()
const completeMock = vi.fn()
const traceMock = vi.fn()
const flushMock = vi.fn()

const sessionRepository = {
  findById: findSessionByIdMock,
  create: vi.fn(),
  update: updateSessionMock,
  delete: vi.fn(),
  countByScenarioId: vi.fn(),
  countActiveByScenarioId: vi.fn(),
}

const conversationRepository = {
  findById: findConversationByIdMock,
  create: vi.fn(),
  listBySessionId: vi.fn(),
  update: updateConversationMock,
}

const avatarRepository = {
  findById: findAvatarByIdMock,
  create: vi.fn(),
  listByScenarioId: vi.fn(),
  delete: vi.fn(),
}

const messageRepository = {
  findByConversationId: findMessagesByConversationIdMock,
  save: saveMessageMock,
  deleteByConversationId: vi.fn(),
}

const llm = { complete: completeMock }
const observability = { trace: traceMock, flush: flushMock }

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    activeAvatarId: 'avatar_1',
    status: 'active',
    startedAt: '2026-04-18T10:00:00.000Z',
    lastActivityAt: '2026-04-18T10:00:00.000Z',
    ...overrides,
  }
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    conversationId: 'conversation_1',
    sessionId: 'session_1',
    avatarId: 'avatar_1',
    status: 'active',
    startedAt: '2026-04-18T10:00:00.000Z',
    lastActivityAt: '2026-04-18T10:00:00.000Z',
    ...overrides,
  }
}

function makeAvatar(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    avatarId: 'avatar_1',
    scenarioId: 'scenario_1',
    name: 'Ava',
    status: 'active',
    personaPrompt: 'You are Ava.',
    config: {},
    createdAt: '2026-04-20T10:00:00.000Z',
    updatedAt: '2026-04-20T10:00:00.000Z',
    ...overrides,
  }
}

function createUseCase(): SendMessageUseCase {
  return new SendMessageUseCase(
    sessionRepository,
    conversationRepository,
    avatarRepository,
    messageRepository,
    llm,
    observability,
  )
}

beforeEach(() => {
  findSessionByIdMock.mockReset()
  updateSessionMock.mockReset()
  findConversationByIdMock.mockReset()
  updateConversationMock.mockReset()
  findAvatarByIdMock.mockReset()
  findMessagesByConversationIdMock.mockReset()
  saveMessageMock.mockReset()
  completeMock.mockReset()
  traceMock.mockReset()
  flushMock.mockReset()

  findSessionByIdMock.mockResolvedValue(makeSession())
  updateSessionMock.mockResolvedValue(makeSession())
  findConversationByIdMock.mockResolvedValue(makeConversation())
  updateConversationMock.mockResolvedValue(makeConversation())
  findAvatarByIdMock.mockResolvedValue(makeAvatar())
  findMessagesByConversationIdMock.mockResolvedValue([])
  saveMessageMock.mockImplementation((message: Message) => Promise.resolve(message))
  completeMock.mockResolvedValue({
    content: 'Avatar reply',
    model: 'null-model',
    inputTokens: 10,
    outputTokens: 20,
    latencyMs: 5,
  })
  traceMock.mockResolvedValue(undefined)
  flushMock.mockResolvedValue(undefined)
})

describe('SendMessageUseCase', () => {
  it('uses conversation.avatarId to resolve speaking avatar', async () => {
    const useCase = createUseCase()
    findConversationByIdMock.mockResolvedValue(makeConversation({ avatarId: 'avatar_2' }))
    findAvatarByIdMock.mockResolvedValue(makeAvatar({ avatarId: 'avatar_2' }))

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })

    expect(findAvatarByIdMock).toHaveBeenCalledWith('avatar_2')
  })

  it('persists and reads messages by conversationId', async () => {
    const useCase = createUseCase()

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })

    expect(findMessagesByConversationIdMock).toHaveBeenCalledWith('conversation_1', { limit: 20 })
    expect(saveMessageMock.mock.calls[0]?.[0]).toMatchObject({
      conversationId: 'conversation_1',
      role: 'user',
    })
    expect(saveMessageMock.mock.calls[1]?.[0]).toMatchObject({
      conversationId: 'conversation_1',
      role: 'avatar',
    })
  })

  it('returns NOT_FOUND for unknown conversation', async () => {
    const useCase = createUseCase()
    findConversationByIdMock.mockResolvedValue(null)

    await expect(
      useCase.execute({ conversationId: 'conversation_missing', userMessage: 'Hello' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

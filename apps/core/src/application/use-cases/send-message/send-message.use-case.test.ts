import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { Conversation, Message, Session } from '../../../domain/conversation/session.types.js'
import type { RunGameMasterUseCase } from '../run-game-master/run-game-master.use-case.js'
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
const runGameMasterExecuteMock = vi.fn()

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
  findActiveBySessionId: vi.fn(),
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

function createUseCase(withRunGameMaster = false): SendMessageUseCase {
  const runGameMasterUseCase = withRunGameMaster
    ? ({ execute: runGameMasterExecuteMock } as unknown as RunGameMasterUseCase)
    : null
  return new SendMessageUseCase(
    sessionRepository,
    conversationRepository,
    avatarRepository,
    messageRepository,
    llm,
    observability,
    runGameMasterUseCase,
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
  runGameMasterExecuteMock.mockReset()

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
  runGameMasterExecuteMock.mockResolvedValue(undefined)
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

  it('injects gmNotes into persona system prompt when present on session', async () => {
    const useCase = createUseCase()
    findSessionByIdMock.mockResolvedValue(
      makeSession({ gmNotes: 'Push user deeper into examples.' }),
    )

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })

    const llmRequestUnknown: unknown = completeMock.mock.calls[0]?.[0]
    if (
      typeof llmRequestUnknown !== 'object' ||
      llmRequestUnknown === null ||
      typeof (llmRequestUnknown as { systemPrompt?: unknown }).systemPrompt !== 'string'
    ) {
      throw new Error('Expected llm request with a string systemPrompt')
    }
    const llmRequest = llmRequestUnknown as { systemPrompt: string }
    expect(llmRequest.systemPrompt).toContain('Director notes: Push user deeper into examples.')
  })

  it('clears gmNotes after the turn that consumes them', async () => {
    const useCase = createUseCase()
    findSessionByIdMock.mockResolvedValue(
      makeSession({ gmNotes: 'Handoff summary for next avatar turn.' }),
    )

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })

    expect(updateSessionMock).toHaveBeenCalledWith(
      'session_1',
      expect.objectContaining({
        gmNotes: null,
      }),
    )
  })

  it('does not send gmNotes clearing update when no gmNotes exist', async () => {
    const useCase = createUseCase()
    findSessionByIdMock.mockResolvedValue(makeSession())

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })

    expect(updateSessionMock).toHaveBeenCalledWith(
      'session_1',
      expect.not.objectContaining({ gmNotes: undefined }),
    )
  })

  it('fires run game master in the background when dependency is provided', async () => {
    const useCase = createUseCase(true)

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })

    expect(runGameMasterExecuteMock).toHaveBeenCalledTimes(1)
    expect(runGameMasterExecuteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session_1',
        scenarioId: 'scenario_1',
        avatarId: 'avatar_1',
        userMessageText: 'Hello',
      }),
    )
  })
})

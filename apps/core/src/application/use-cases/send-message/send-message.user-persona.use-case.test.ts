import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session, Conversation, Message } from '../../../domain/conversation/session.types.js'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { User } from '../../../domain/user/user.types.js'
import type { RunGameMasterUseCase } from '../run-game-master/run-game-master.use-case.js'
import { SendMessageUseCase } from './send-message.use-case.js'

const findSessionByIdMock = vi.fn()
const updateSessionMock = vi.fn()
const findConversationByIdMock = vi.fn()
const findAvatarByIdMock = vi.fn()
const findScenarioByIdMock = vi.fn()
const listAvatarsByScenarioIdMock = vi.fn()
const findMessagesByConversationIdMock = vi.fn()
const saveMessageMock = vi.fn()
const completeMock = vi.fn()
const appendEventMock = vi.fn()
const runGameMasterExecuteMock = vi.fn()
const findUserByIdMock = vi.fn()

const sessionRepository = {
  findById: findSessionByIdMock,
  create: vi.fn(),
  update: updateSessionMock,
  delete: vi.fn(),
  list: vi.fn(),
  countByScenarioId: vi.fn(),
  countActiveByScenarioId: vi.fn(),
}
const conversationRepository = {
  findById: findConversationByIdMock,
  findActiveBySessionId: vi.fn(),
  create: vi.fn(),
  listBySessionId: vi.fn(),
  deleteBySessionId: vi.fn(),
  update: vi.fn(),
}
const avatarRepository = {
  findById: findAvatarByIdMock,
  create: vi.fn(),
  listByScenarioId: listAvatarsByScenarioIdMock,
  delete: vi.fn(),
  update: vi.fn(),
}
const scenarioRepository = {
  create: vi.fn(),
  findById: findScenarioByIdMock,
  list: vi.fn(),
  delete: vi.fn(),
  update: vi.fn(),
}
const messageRepository = {
  findByConversationId: findMessagesByConversationIdMock,
  save: saveMessageMock,
  deleteByConversationId: vi.fn(),
}
const llm = { complete: completeMock }
const eventLogRepository = { append: appendEventMock, findBySessionId: vi.fn() }
const userRepository = { findById: findUserByIdMock, upsert: vi.fn() }

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

function createUseCase(
  withRunGameMaster: boolean,
  withUserRepository: boolean,
): SendMessageUseCase {
  return new SendMessageUseCase(
    sessionRepository,
    conversationRepository,
    avatarRepository,
    scenarioRepository,
    messageRepository,
    llm,
    eventLogRepository,
    withRunGameMaster
      ? ({ execute: runGameMasterExecuteMock } as unknown as RunGameMasterUseCase)
      : null,
    withUserRepository ? userRepository : undefined,
  )
}

beforeEach(() => {
  findSessionByIdMock.mockReset()
  updateSessionMock.mockReset()
  findConversationByIdMock.mockReset()
  findAvatarByIdMock.mockReset()
  findScenarioByIdMock.mockReset()
  listAvatarsByScenarioIdMock.mockReset()
  findMessagesByConversationIdMock.mockReset()
  saveMessageMock.mockReset()
  completeMock.mockReset()
  appendEventMock.mockReset()
  runGameMasterExecuteMock.mockReset()
  findUserByIdMock.mockReset()

  findSessionByIdMock.mockResolvedValue(makeSession())
  updateSessionMock.mockResolvedValue(makeSession())
  findConversationByIdMock.mockResolvedValue(makeConversation())
  findAvatarByIdMock.mockResolvedValue(makeAvatar())
  findScenarioByIdMock.mockResolvedValue({
    scenarioId: 'scenario_1',
    name: 'Scenario',
    status: 'active',
    config: {},
    createdAt: '2026-04-18T10:00:00.000Z',
    updatedAt: '2026-04-18T10:00:00.000Z',
  })
  listAvatarsByScenarioIdMock.mockResolvedValue([makeAvatar()])
  findMessagesByConversationIdMock.mockResolvedValue([])
  saveMessageMock.mockImplementation((message: Message) => Promise.resolve(message))
  completeMock.mockResolvedValue({
    content: 'Avatar reply',
    model: 'null-model',
    inputTokens: 10,
    outputTokens: 20,
    latencyMs: 5,
  })
  appendEventMock.mockResolvedValue(undefined)
  runGameMasterExecuteMock.mockResolvedValue(undefined)
  findUserByIdMock.mockResolvedValue(null)
})

describe('SendMessageUseCase — user persona injection', () => {
  it('injects persona role sentence when user repository returns persona', async () => {
    const useCase = createUseCase(false, true)
    findUserByIdMock.mockResolvedValue({
      userId: 'user_1',
      persona: { role: 'psychologist' },
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:00:00.000Z',
    } satisfies User)

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })

    const llmRequest = completeMock.mock.calls[0]?.[0] as { systemPrompt: string }
    expect(llmRequest.systemPrompt).toContain(
      'You are speaking with someone in the role of: psychologist.',
    )
  })

  it('succeeds when user repository is not injected', async () => {
    const useCase = createUseCase(false, false)

    await expect(
      useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' }),
    ).resolves.toBeDefined()
  })

  it('succeeds when user repository lookup throws and omits persona sentence', async () => {
    const useCase = createUseCase(false, true)
    findUserByIdMock.mockRejectedValueOnce(new Error('user lookup unavailable'))

    await expect(
      useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' }),
    ).resolves.toBeDefined()

    const llmRequest = completeMock.mock.calls[0]?.[0] as { systemPrompt: string }
    expect(llmRequest.systemPrompt).not.toContain('You are speaking with someone in the role of:')
  })

  it('omits persona sentence when user exists without persona', async () => {
    const useCase = createUseCase(false, true)
    findUserByIdMock.mockResolvedValue({
      userId: 'user_1',
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:00:00.000Z',
    } satisfies User)

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })

    const llmRequest = completeMock.mock.calls[0]?.[0] as { systemPrompt: string }
    expect(llmRequest.systemPrompt).not.toContain('You are speaking with someone in the role of:')
  })

  it('passes userPersona to run game master when persona is present', async () => {
    const useCase = createUseCase(true, true)
    findUserByIdMock.mockResolvedValue({
      userId: 'user_1',
      persona: { role: 'coach' },
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:00:00.000Z',
    } satisfies User)

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })

    expect(runGameMasterExecuteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userPersona: { role: 'coach' },
      }),
    )
  })

  it('calls run game master without userPersona when persona is absent', async () => {
    const useCase = createUseCase(true, true)
    findUserByIdMock.mockResolvedValue({
      userId: 'user_1',
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:00:00.000Z',
    } satisfies User)

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })

    const gmInput = runGameMasterExecuteMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(Object.hasOwn(gmInput, 'userPersona')).toBe(false)
  })
})

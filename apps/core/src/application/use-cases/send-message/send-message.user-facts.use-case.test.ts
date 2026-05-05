import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserFact } from '../../../domain/memory/memory.types.js'
import type { Session, Conversation, Message } from '../../../domain/conversation/session.types.js'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
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
const traceMock = vi.fn()
const findUserByIdMock = vi.fn()
const findUserFactsByUserIdMock = vi.fn()

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
const observability = { trace: traceMock, flush: vi.fn() }
const userRepository = { findById: findUserByIdMock, upsert: vi.fn() }
const userMemoryFactRepository = {
  findByUserId: findUserFactsByUserIdMock,
  upsert: vi.fn(),
  findById: vi.fn(),
  deleteById: vi.fn(),
}

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

function createUseCase(withUserMemoryFactRepository: boolean): SendMessageUseCase {
  return new SendMessageUseCase(
    sessionRepository,
    conversationRepository,
    avatarRepository,
    scenarioRepository,
    messageRepository,
    llm,
    eventLogRepository,
    observability,
    null,
    userRepository,
    null,
    undefined,
    withUserMemoryFactRepository ? userMemoryFactRepository : undefined,
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
  traceMock.mockReset()
  appendEventMock.mockReset()
  findUserByIdMock.mockReset()
  findUserFactsByUserIdMock.mockReset()

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
  traceMock.mockResolvedValue(undefined)
  appendEventMock.mockResolvedValue(undefined)
  findUserByIdMock.mockResolvedValue(null)
  findUserFactsByUserIdMock.mockResolvedValue([])
})

describe('SendMessageUseCase — user facts injection', () => {
  it('succeeds when userMemoryFactRepository is not injected and omits user context section', async () => {
    const useCase = createUseCase(false)

    await expect(
      useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' }),
    ).resolves.toBeDefined()

    const llmRequest = completeMock.mock.calls[0]?.[0] as { systemPrompt: string }
    expect(llmRequest.systemPrompt).not.toContain('## User Context (remembered facts)')
  })

  it('injects user facts from repository into system prompt', async () => {
    const useCase = createUseCase(true)
    findUserFactsByUserIdMock.mockResolvedValue([
      makeUserFact({ key: 'language', value: 'English' }),
      makeUserFact({ key: 'role', value: 'friend' }),
    ])

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })

    const llmRequest = completeMock.mock.calls[0]?.[0] as { systemPrompt: string }
    expect(llmRequest.systemPrompt).toContain('## User Context (remembered facts)')
    expect(llmRequest.systemPrompt).toContain('language: English')
    expect(llmRequest.systemPrompt).toContain('role: friend')
  })

  it('succeeds when user fact repository throws', async () => {
    const useCase = createUseCase(true)
    findUserFactsByUserIdMock.mockRejectedValueOnce(new Error('memory read failed'))

    await expect(
      useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' }),
    ).resolves.toBeDefined()
  })

  it('uses only the 10 most recent facts', async () => {
    const useCase = createUseCase(true)
    findUserFactsByUserIdMock.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) =>
        makeUserFact({ key: `fact_${String(i)}`, value: `value_${String(i)}` }),
      ),
    )

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })

    const llmRequest = completeMock.mock.calls[0]?.[0] as { systemPrompt: string }
    expect(llmRequest.systemPrompt).toContain('fact_0: value_0')
    expect(llmRequest.systemPrompt).toContain('fact_9: value_9')
    expect(llmRequest.systemPrompt).not.toContain('fact_10: value_10')
    expect(llmRequest.systemPrompt).not.toContain('fact_11: value_11')
  })
})

function makeUserFact(overrides: Partial<UserFact> = {}): UserFact {
  return {
    id: 'umf_1',
    userId: 'user_1',
    category: 'preference',
    key: 'language',
    value: 'English',
    confidence: 0.8,
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
    ...overrides,
  }
}

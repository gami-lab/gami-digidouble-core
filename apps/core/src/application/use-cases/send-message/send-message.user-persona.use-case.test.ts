import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session, Conversation, Message } from '../../../domain/conversation/session.types.js'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { User } from '../../../domain/user/user.types.js'
import type { TypedRetrievalService } from '../../services/knowledge/typed-retrieval.service.js'
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
const retrieveTypedContextMock = vi.fn()

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
  withTypedRetrieval = false,
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
    null,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    withTypedRetrieval
      ? ({ retrieve: retrieveTypedContextMock } as unknown as TypedRetrievalService)
      : undefined,
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
  retrieveTypedContextMock.mockReset()

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
  retrieveTypedContextMock.mockResolvedValue({
    memory: [],
    world: [],
    media: [],
    trace: {
      query: 'q',
      perType: {
        memory: { sourceIds: [], selectedChunkIds: [] },
        world: { sourceIds: [], selectedChunkIds: [] },
        media: { sourceIds: [], selectedChunkIds: [] },
      },
    },
  })
})

describe('SendMessageUseCase — user persona injection', () => {
  it('injects rich persona context when user repository returns persona', async () => {
    const useCase = createUseCase(false, true)
    findUserByIdMock.mockResolvedValue({
      userId: 'user_1',
      persona: {
        name: 'Maya',
        roleInWorld: 'student',
        avatarRelationships: ['Friend of Eva'],
        dialogGuidance: 'Prefers concise answers',
      },
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:00:00.000Z',
    } satisfies User)

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })

    const llmRequest = completeMock.mock.calls[0]?.[0] as { systemPrompt: string }
    expect(llmRequest.systemPrompt).toContain('## User Persona')
    expect(llmRequest.systemPrompt).toContain('Name: Maya')
    expect(llmRequest.systemPrompt).toContain('Role in this world: student')
    expect(llmRequest.systemPrompt).toContain('Potential avatar relationships: Friend of Eva')
    expect(llmRequest.systemPrompt).toContain('Dialog guidance: Prefers concise answers')
  })

  it('succeeds when user repository is not injected', async () => {
    const useCase = createUseCase(false, false)

    await expect(
      useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' }),
    ).resolves.toBeDefined()
  })

  it('succeeds when user repository lookup throws and omits persona section', async () => {
    const useCase = createUseCase(false, true)
    findUserByIdMock.mockRejectedValueOnce(new Error('user lookup unavailable'))

    await expect(
      useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' }),
    ).resolves.toBeDefined()

    const llmRequest = completeMock.mock.calls[0]?.[0] as { systemPrompt: string }
    expect(llmRequest.systemPrompt).not.toContain('## User Persona')
  })

  it('omits persona section when user exists without persona', async () => {
    const useCase = createUseCase(false, true)
    findUserByIdMock.mockResolvedValue({
      userId: 'user_1',
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:00:00.000Z',
    } satisfies User)

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })

    const llmRequest = completeMock.mock.calls[0]?.[0] as { systemPrompt: string }
    expect(llmRequest.systemPrompt).not.toContain('## User Persona')
  })

  it('passes userPersona to run game master when persona is present', async () => {
    const useCase = createUseCase(true, true)
    findUserByIdMock.mockResolvedValue({
      userId: 'user_1',
      persona: {
        name: 'Maya',
        roleInWorld: 'student',
        avatarRelationships: ['Friend of Eva'],
        dialogGuidance: 'Prefers concise answers',
      },
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:00:00.000Z',
    } satisfies User)

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })

    expect(runGameMasterExecuteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userPersona: {
          name: 'Maya',
          roleInWorld: 'student',
          avatarRelationships: ['Friend of Eva'],
          dialogGuidance: 'Prefers concise answers',
        },
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

describe('SendMessageUseCase — prompt assembly v2 context influence', () => {
  it('changes assembled system prompt deterministically when persona changes', async () => {
    const useCase = createUseCase(false, true)
    findUserByIdMock.mockResolvedValueOnce({
      userId: 'user_1',
      persona: { name: 'Maya', roleInWorld: 'student' },
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:00:00.000Z',
    } satisfies User)
    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })
    const withPersonaPrompt = (completeMock.mock.calls[0]?.[0] as { systemPrompt: string })
      .systemPrompt

    findUserByIdMock.mockResolvedValueOnce({
      userId: 'user_1',
      persona: { name: 'Lina', roleInWorld: 'mentor' },
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:00:00.000Z',
    } satisfies User)
    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })
    const changedPersonaPrompt = (completeMock.mock.calls[1]?.[0] as { systemPrompt: string })
      .systemPrompt

    expect(withPersonaPrompt).not.toBe(changedPersonaPrompt)
    expect(withPersonaPrompt).toContain('Name: Maya')
    expect(changedPersonaPrompt).toContain('Name: Lina')
  })

  it('injects typed retrieval context into prompt through canonical context assembly', async () => {
    const useCase = createUseCase(false, true, true)
    findMessagesByConversationIdMock.mockResolvedValue([
      {
        messageId: 'message_prev',
        conversationId: 'conversation_1',
        role: 'user',
        content: 'How do tides affect docking?',
        createdAt: '2026-05-06T10:00:00.000Z',
      },
    ])
    retrieveTypedContextMock.mockResolvedValue({
      memory: [
        {
          sourceId: 'source_1',
          chunkId: 'chunk_1',
          knowledgeType: 'memory',
          content: 'User prefers concrete checklists.',
        },
      ],
      world: [
        {
          sourceId: 'source_2',
          chunkId: 'chunk_2',
          knowledgeType: 'world',
          content: 'Ships dock at tidefall in this harbor.',
        },
      ],
      media: [],
      trace: {
        query: 'How do tides affect docking?',
        perType: {
          memory: { sourceIds: ['source_1'], selectedChunkIds: ['chunk_1'] },
          world: { sourceIds: ['source_2'], selectedChunkIds: ['chunk_2'] },
          media: { sourceIds: [], selectedChunkIds: [] },
        },
      },
    })

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'What should I do?' })

    const llmRequest = completeMock.mock.calls[0]?.[0] as { systemPrompt: string }
    expect(llmRequest.systemPrompt).toContain('## Retrieved Context')
    expect(llmRequest.systemPrompt).toContain('Memory retrieval:')
    expect(llmRequest.systemPrompt).toContain('User prefers concrete checklists.')
    expect(llmRequest.systemPrompt).toContain('World retrieval:')
    expect(llmRequest.systemPrompt).toContain('Ships dock at tidefall in this harbor.')
  })
})

describe('SendMessageUseCase — context selection observability', () => {
  it('emits non-sensitive context selection metadata in turn_completed event payload', async () => {
    const useCase = createUseCase(false, true, true)
    findMessagesByConversationIdMock.mockResolvedValue([
      {
        messageId: 'message_prev',
        conversationId: 'conversation_1',
        role: 'user',
        content: 'How do tides affect docking?',
        createdAt: '2026-05-06T10:00:00.000Z',
      },
      {
        messageId: 'message_prev_2',
        conversationId: 'conversation_1',
        role: 'avatar',
        content: 'Use the tide chart.',
        createdAt: '2026-05-06T10:00:01.000Z',
      },
    ])
    findUserByIdMock.mockResolvedValue({
      userId: 'user_1',
      persona: { name: 'Maya' },
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:00:00.000Z',
    } satisfies User)
    retrieveTypedContextMock.mockResolvedValue({
      memory: [
        {
          sourceId: 'source_1',
          chunkId: 'chunk_1',
          knowledgeType: 'memory',
          content: 'User prefers concise checklists.',
        },
      ],
      world: [],
      media: [],
      trace: {
        query: 'How do tides affect docking?',
        perType: {
          memory: { sourceIds: ['source_1'], selectedChunkIds: ['chunk_1'] },
          world: { sourceIds: [], selectedChunkIds: [] },
          media: { sourceIds: [], selectedChunkIds: [] },
        },
      },
    })

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'What should I do?' })
    await new Promise((resolve) => setTimeout(resolve, 0))

    const event = appendEventMock.mock.calls[0]?.[0] as {
      payload: {
        contextSelection?: {
          shortTermExchangeCount: number
          hasWorkingMemory: boolean
          longTermFactCount: number
          retrievalCounts: { memory: number; world: number; media: number }
          visibility?: {
            activeAvatarId?: string
            excludedCounts: { memory: number; world: number; media: number }
            gmRetrievalCounts?: { memory: number; world: number; media: number }
            gmUnrestricted?: true
          }
          hasUserPersona: boolean
          hasGmDirective: boolean
        }
        retrievalLatencyMs?: number
        otherOverheadMs?: number
      }
    }
    expect(event.payload.contextSelection).toEqual({
      shortTermExchangeCount: 1,
      hasWorkingMemory: false,
      longTermFactCount: 0,
      retrievalCounts: { memory: 1, world: 0, media: 0 },
      visibility: {
        activeAvatarId: 'avatar_1',
        excludedCounts: { memory: 0, world: 0, media: 0 },
        gmRetrievalCounts: { memory: 1, world: 0, media: 0 },
        gmUnrestricted: true,
      },
      hasUserPersona: true,
      hasGmDirective: false,
    })
    expect(event.payload.retrievalLatencyMs).toBeTypeOf('number')
    expect(event.payload.otherOverheadMs).toBeTypeOf('number')
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemorySelectionService } from '../../services/memory-selection.service.js'
import { RunGameMasterUseCase } from './run-game-master.use-case.js'

const findBySessionIdMock = vi.fn()
const saveMock = vi.fn()
const findSessionByIdMock = vi.fn()
const updateSessionMock = vi.fn()
const listAvatarsByScenarioIdMock = vi.fn()
const findMessagesByConversationIdMock = vi.fn()
const findConversationWorkingMemoryByConversationIdMock = vi.fn()
const listConversationMemoriesByScopeMock = vi.fn()
const findFactsByUserIdMock = vi.fn()
const completeMock = vi.fn()
const traceMock = vi.fn()

const gmStateRepository = { findBySessionId: findBySessionIdMock, save: saveMock }
const sessionRepository = {
  findById: findSessionByIdMock,
  create: vi.fn(),
  update: updateSessionMock,
  delete: vi.fn(),
  list: vi.fn(),
  countByScenarioId: vi.fn(),
  countActiveByScenarioId: vi.fn(),
}
const avatarRepository = {
  findById: vi.fn(),
  create: vi.fn(),
  listByScenarioId: listAvatarsByScenarioIdMock,
  delete: vi.fn(),
  update: vi.fn(),
}
const messageRepository = {
  create: vi.fn(),
  save: vi.fn(),
  findByConversationId: findMessagesByConversationIdMock,
  findById: vi.fn(),
  deleteByConversationId: vi.fn(),
}
const conversationWorkingMemoryRepository = {
  findByConversationId: findConversationWorkingMemoryByConversationIdMock,
  upsert: vi.fn(),
  deleteBySessionId: vi.fn(),
}
const conversationMemoryRepository = {
  findByConversationId: vi.fn(),
  create: vi.fn(),
  listByScope: listConversationMemoriesByScopeMock,
  deleteBySessionId: vi.fn(),
}
const userMemoryFactRepository = {
  findByUserId: findFactsByUserIdMock,
  upsert: vi.fn(),
  deleteById: vi.fn(),
  findById: vi.fn(),
}
const llm = { complete: completeMock }
const observability = { trace: traceMock, flush: vi.fn() }

type GmMemory = {
  workingMemory?: { summary: string; unresolvedThreads: string[] }
  episodicMemories?: Array<{ conversationId: string; selectionReasons?: string[] }>
  longTermFacts?: Array<{ category: string; key: string; value: string }>
}

type GmRecentMessage = { role: 'user' | 'avatar' | 'system'; content: string }

function readRecentMessages(): GmRecentMessage[] {
  const rawContent =
    (completeMock.mock.calls[0]?.[0] as { messages: Array<{ content: string }> }).messages[0]
      ?.content ?? '{}'
  return (JSON.parse(rawContent) as { recentMessages?: GmRecentMessage[] }).recentMessages ?? []
}

function readGmMemory(): GmMemory {
  const rawContent =
    (completeMock.mock.calls[0]?.[0] as { messages: Array<{ content: string }> }).messages[0]
      ?.content ?? '{}'
  return (JSON.parse(rawContent) as { context: { memory: GmMemory } }).context.memory
}

function makeEpisodicMemory() {
  return {
    conversationId: 'conv_past_1',
    sessionId: 'session_1',
    userId: 'user_1',
    avatarId: 'avatar_1',
    scenarioId: 'scenario_1',
    summary: 'Previously discussed onboarding.',
    keyDiscoveries: ['Needs onboarding'],
    unresolvedTopics: ['Follow up on onboarding'],
    factCandidates: [],
    createdAt: '2026-04-01T10:00:00.000Z',
  }
}

function createUseCase(): RunGameMasterUseCase {
  const memorySelection = new MemorySelectionService(
    messageRepository,
    conversationWorkingMemoryRepository,
    conversationMemoryRepository,
    userMemoryFactRepository,
  )
  return new RunGameMasterUseCase(
    gmStateRepository,
    sessionRepository,
    avatarRepository,
    llm,
    observability,
    undefined,
    undefined,
    undefined,
    messageRepository,
    undefined,
    memorySelection,
  )
}

beforeEach(() => {
  findBySessionIdMock.mockReset()
  saveMock.mockReset()
  findSessionByIdMock.mockReset()
  updateSessionMock.mockReset()
  listAvatarsByScenarioIdMock.mockReset()
  findMessagesByConversationIdMock.mockReset()
  findConversationWorkingMemoryByConversationIdMock.mockReset()
  listConversationMemoriesByScopeMock.mockReset()
  findFactsByUserIdMock.mockReset()
  completeMock.mockReset()
  traceMock.mockReset()

  findBySessionIdMock.mockResolvedValue({
    progression: 'none',
    topicsCovered: [],
    interactionCount: 1,
    currentAvatarId: 'avatar_1',
  })
  saveMock.mockResolvedValue(undefined)
  findSessionByIdMock.mockResolvedValue({
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    activeAvatarId: 'avatar_1',
    status: 'active',
    startedAt: '2026-04-18T10:00:00.000Z',
    lastActivityAt: '2026-04-18T10:00:00.000Z',
  })
  updateSessionMock.mockResolvedValue(undefined)
  listAvatarsByScenarioIdMock.mockResolvedValue([
    {
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      name: 'Ava',
      status: 'active',
      personaPrompt: 'You are Ava.',
      config: {},
      createdAt: '2026-04-20T10:00:00.000Z',
      updatedAt: '2026-04-20T10:00:00.000Z',
    },
  ])
  completeMock.mockResolvedValue({
    content: JSON.stringify({
      avatarId: 'avatar_1',
      conversationMode: 'continue',
      stateUpdate: { interactionIncrement: 1 },
    }),
    model: 'null-model',
    inputTokens: 10,
    outputTokens: 20,
    latencyMs: 4,
  })
  traceMock.mockResolvedValue(undefined)
})

describe('RunGameMasterUseCase memory input', () => {
  it('injects bounded recent exchanges plus working-memory context with deduplicated memory payload', async () => {
    const useCase = createUseCase()
    findMessagesByConversationIdMock.mockResolvedValue([
      { role: 'user', content: 'U0', createdAt: '2026-04-18T10:00:00.000Z' },
      { role: 'avatar', content: 'A0', createdAt: '2026-04-18T10:00:00.500Z' },
      { role: 'user', content: 'U1', createdAt: '2026-04-18T10:00:01.000Z' },
      { role: 'avatar', content: 'A1', createdAt: '2026-04-18T10:00:02.000Z' },
      { role: 'user', content: 'U2', createdAt: '2026-04-18T10:00:03.000Z' },
      { role: 'avatar', content: 'A2', createdAt: '2026-04-18T10:00:04.000Z' },
      { role: 'user', content: 'U3', createdAt: '2026-04-18T10:00:05.000Z' },
      { role: 'avatar', content: 'A3', createdAt: '2026-04-18T10:00:06.000Z' },
    ])
    findConversationWorkingMemoryByConversationIdMock.mockResolvedValue({
      conversationId: 'conversation_1',
      sessionId: 'session_1',
      avatarId: 'avatar_1',
      summary: 'Session working summary',
      unresolvedThreads: ['Follow up on budget'],
      candidateFacts: [],
      updatedAt: '2026-04-18T10:00:00.500Z', // after U0/A0 → U1–A3 are uncovered (3 exchanges)
    })
    listConversationMemoriesByScopeMock.mockResolvedValue([])
    findFactsByUserIdMock.mockResolvedValue([
      {
        id: 'fact_1',
        userId: 'user_1',
        category: 'preference',
        key: 'tone',
        value: 'concise',
        confidence: null,
        createdAt: '2026-04-18T10:00:00.000Z',
        updatedAt: '2026-04-18T10:00:00.000Z',
      },
    ])

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      conversationId: 'conversation_1',
      userMessageText: 'hello',
      turnIndex: 2,
      correlationId: 'request_memory_layers',
    })

    const memory = readGmMemory()
    const recentMessages = readRecentMessages()

    expect(recentMessages).toEqual([
      { role: 'user', content: 'U1' },
      { role: 'avatar', content: 'A1' },
      { role: 'user', content: 'U2' },
      { role: 'avatar', content: 'A2' },
      { role: 'user', content: 'U3' },
      { role: 'avatar', content: 'A3' },
    ])
    expect(memory).not.toHaveProperty('shortTerm')
    expect(memory).not.toHaveProperty('workingSummary')
    expect(memory.workingMemory).toEqual({
      summary: 'Session working summary',
      unresolvedThreads: ['Follow up on budget'],
    })
    expect(memory.episodicMemories).toBeUndefined()
    expect(memory.longTermFacts).toEqual([
      { category: 'preference', key: 'tone', value: 'concise' },
    ])
  })

  it('injects bounded episodic memories with selection reasons when episodic candidates are present', async () => {
    const useCase = createUseCase()
    findMessagesByConversationIdMock.mockResolvedValue([])
    findConversationWorkingMemoryByConversationIdMock.mockResolvedValue(null)
    listConversationMemoriesByScopeMock.mockResolvedValue([makeEpisodicMemory()])
    findFactsByUserIdMock.mockResolvedValue([])
    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      conversationId: 'conversation_1',
      userMessageText: 'onboarding',
      turnIndex: 1,
      correlationId: 'request_episodic',
    })
    const memory = readGmMemory()
    const first = memory.episodicMemories?.[0]
    expect(memory.episodicMemories?.length).toBeGreaterThan(0)
    expect(first?.conversationId).toBe('conv_past_1')
    expect(first?.selectionReasons?.length).toBeGreaterThan(0)
  })
})

describe('RunGameMasterUseCase output normalization', () => {
  it('normalizes avatar name references to IDs before persisting state', async () => {
    const useCase = createUseCase()
    findMessagesByConversationIdMock.mockResolvedValue([])
    findConversationWorkingMemoryByConversationIdMock.mockResolvedValue(null)
    listConversationMemoriesByScopeMock.mockResolvedValue([])
    findFactsByUserIdMock.mockResolvedValue([])
    listAvatarsByScenarioIdMock.mockResolvedValue([
      {
        avatarId: 'avatar_1',
        scenarioId: 'scenario_1',
        name: 'Eva',
        status: 'active',
        personaPrompt: 'You are Eva.',
        config: {},
        createdAt: '2026-04-20T10:00:00.000Z',
        updatedAt: '2026-04-20T10:00:00.000Z',
      },
      {
        avatarId: 'avatar_2',
        scenarioId: 'scenario_1',
        name: 'Theo',
        status: 'active',
        personaPrompt: 'You are Theo.',
        config: {},
        createdAt: '2026-04-20T10:00:00.000Z',
        updatedAt: '2026-04-20T10:00:00.000Z',
      },
    ])
    completeMock.mockResolvedValueOnce({
      content: JSON.stringify({
        avatarId: 'Eva',
        conversationMode: 'continue',
        suggestedAvatarId: 'Theo',
        stateUpdate: {
          activeAvatarId: 'Eva',
          interactionIncrement: 1,
        },
      }),
      model: 'null-model',
      inputTokens: 10,
      outputTokens: 20,
      latencyMs: 4,
    })

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      conversationId: 'conversation_1',
      userMessageText: 'switch to ethics',
      turnIndex: 2,
      correlationId: 'corr_name_to_id',
    })

    const persistedState = saveMock.mock.calls[0]?.[1] as { currentAvatarId?: string } | undefined
    expect(persistedState?.currentAvatarId).toBe('avatar_1')
  })
})

describe('RunGameMasterUseCase trace context', () => {
  it('attaches wrapper trace context for centralized gm llm observability', async () => {
    const useCase = createUseCase()
    findMessagesByConversationIdMock.mockResolvedValue([])
    findConversationWorkingMemoryByConversationIdMock.mockResolvedValue(null)
    listConversationMemoriesByScopeMock.mockResolvedValue([])
    findFactsByUserIdMock.mockResolvedValue([])

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      conversationId: 'conversation_1',
      userMessageText: 'hello',
      turnIndex: 2,
      correlationId: 'corr_trace_ctx',
    })

    const request = completeMock.mock.calls[0]?.[0] as {
      trace?: {
        requestId?: string
        sessionId?: string
        event?: string
        errorEvent?: string
        metadata?: Record<string, unknown>
      }
    }

    expect(request.trace).toEqual(
      expect.objectContaining({
        sessionId: 'session_1',
        event: 'gm.llm_completion',
        errorEvent: 'gm.llm_error',
      }),
    )
    expect(request.trace?.requestId).toMatch(/^gm_[0-9a-f-]{36}$/)
    expect(request.trace?.metadata?.['triggerReason']).toBe('post_turn_observation')
    expect(request.trace?.metadata?.['correlationId']).toBe('corr_trace_ctx')
  })
})

describe('RunGameMasterUseCase assembledContext path', () => {
  it('uses DB-loaded recent messages even when assembledContext is provided', async () => {
    const useCase = createUseCase()
    findMessagesByConversationIdMock.mockResolvedValue([
      { role: 'user', content: 'Hi Clara', createdAt: '2026-04-18T10:00:00.000Z' },
      { role: 'avatar', content: 'Good evening.', createdAt: '2026-04-18T10:00:01.000Z' },
      { role: 'user', content: 'Tell me what you saw', createdAt: '2026-04-18T10:00:02.000Z' },
      { role: 'avatar', content: 'He was collapsed.', createdAt: '2026-04-18T10:00:03.000Z' },
      { role: 'user', content: 'Is he dead?', createdAt: '2026-04-18T10:00:04.000Z' },
      { role: 'avatar', content: 'Yes, unfortunately.', createdAt: '2026-04-18T10:00:05.000Z' },
    ])
    findConversationWorkingMemoryByConversationIdMock.mockResolvedValue(null)
    listConversationMemoriesByScopeMock.mockResolvedValue([])
    findFactsByUserIdMock.mockResolvedValue([])

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      conversationId: 'conversation_1',
      userMessageText: 'Is he dead?',
      turnIndex: 3,
      correlationId: 'corr_assembled_ctx',
      assembledContext: {
        avatar: {
          recentExchanges: [],
          workingMemory: {},
          longTermFacts: [],
          userPersona: null,
          gmNotes: null,
          scenario: { scenarioId: 'scenario_1' },
        },
        gm: {
          recentMessages: [{ role: 'user', content: 'Is he dead?' }],
          memory: {},
          currentState: { progression: '', topicsCovered: [], interactionCount: 2 },
          availableAvatars: [
            { avatarId: 'avatar_1', name: 'Clara Whitcombe', availability: 'available' },
          ],
          userPersona: null,
          scenario: { scenarioId: 'scenario_1' },
        },
        trace: {
          deterministic: true,
          policy: {
            tokenBudget: { avatarMaxTokens: 800, gmMaxTokens: 900 },
            protectedSegments: ['gmDirective', 'scenario'],
            precedence: [
              'gmDirective',
              'scenario',
              'userPersona',
              'shortTermMemory',
              'workingMemory',
              'longTermFacts',
              'typedRetrievalMemory',
              'typedRetrievalWorld',
              'typedRetrievalMedia',
              'recentMessages',
            ],
          },
          selectedInputs: {
            hasActiveAvatar: true,
            recentMessageCount: 1,
            shortTermExchangeCount: 0,
            hasWorkingMemory: false,
            longTermFactCount: 0,
            retrievalCounts: { memory: 0, world: 0, media: 0 },
            hasUserPersona: false,
            hasGmDirective: false,
          },
          rationale: {
            avatarProjection: ['policy-driven-precedence'],
            gmProjection: ['policy-driven-precedence'],
          },
          selection: { kept: [], trimmed: [] },
        },
      },
    })

    const recentMessages = readRecentMessages()
    expect(recentMessages).toEqual([
      { role: 'user', content: 'Hi Clara' },
      { role: 'avatar', content: 'Good evening.' },
      { role: 'user', content: 'Tell me what you saw' },
      { role: 'avatar', content: 'He was collapsed.' },
      { role: 'user', content: 'Is he dead?' },
      { role: 'avatar', content: 'Yes, unfortunately.' },
    ])
  })
})

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
  shortTerm?: { recentExchanges: Array<{ user: string; avatar: string }> }
  workingMemory?: { summary: string; unresolvedThreads: string[] }
  episodicMemories?: Array<{ conversationId: string; selectionReasons?: string[] }>
  longTermFacts?: Array<{ category: string; key: string; value: string }>
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
  it('injects bounded short-term, working, and long-term memory', async () => {
    const useCase = createUseCase()
    findMessagesByConversationIdMock.mockResolvedValue([
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
      updatedAt: '2026-04-18T10:00:06.000Z',
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

    expect(memory.shortTerm?.recentExchanges).toEqual([
      { user: 'U2', avatar: 'A2' },
      { user: 'U3', avatar: 'A3' },
    ])
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

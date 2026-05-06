import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AvatarMemoryContextAssembler } from '../../services/avatar-memory-context-assembler.service.js'
import { RunGameMasterUseCase } from './run-game-master.use-case.js'

const findBySessionIdMock = vi.fn()
const saveMock = vi.fn()
const findSessionByIdMock = vi.fn()
const updateSessionMock = vi.fn()
const listAvatarsByScenarioIdMock = vi.fn()
const findMessagesByConversationIdMock = vi.fn()
const findSessionMemoryBySessionIdMock = vi.fn()
const findAvatarMemoryBySessionAndAvatarMock = vi.fn()
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
const sessionMemoryRepository = {
  findBySessionId: findSessionMemoryBySessionIdMock,
  upsert: vi.fn(),
  deleteBySessionId: vi.fn(),
}
const avatarSessionMemoryRepository = {
  findBySessionIdAndAvatarId: findAvatarMemoryBySessionAndAvatarMock,
  listBySessionId: vi.fn(),
  upsert: vi.fn(),
  deleteBySessionIdAndAvatarId: vi.fn(),
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

function createUseCase(): RunGameMasterUseCase {
  const assembler = new AvatarMemoryContextAssembler(
    messageRepository,
    sessionMemoryRepository,
    avatarSessionMemoryRepository,
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
    assembler,
  )
}

beforeEach(() => {
  findBySessionIdMock.mockReset()
  saveMock.mockReset()
  findSessionByIdMock.mockReset()
  updateSessionMock.mockReset()
  listAvatarsByScenarioIdMock.mockReset()
  findMessagesByConversationIdMock.mockReset()
  findSessionMemoryBySessionIdMock.mockReset()
  findAvatarMemoryBySessionAndAvatarMock.mockReset()
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
    findSessionMemoryBySessionIdMock.mockResolvedValue({
      sessionId: 'session_1',
      summary: 'Session working summary',
      updatedAt: '2026-04-18T10:00:06.000Z',
    })
    findAvatarMemoryBySessionAndAvatarMock.mockResolvedValue({
      sessionId: 'session_1',
      avatarId: 'avatar_1',
      summary: 'Avatar working summary',
      updatedAt: '2026-04-18T10:00:06.000Z',
    })
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

    const request = completeMock.mock.calls[0]?.[0] as { messages: Array<{ content: string }> }
    const memory = (
      JSON.parse(request.messages[0]?.content ?? '{}') as { context: { memory: unknown } }
    ).context.memory as {
      shortTerm?: { recentExchanges: Array<{ user: string; avatar: string }> }
      workingSummary?: string
      longTermFacts?: Array<{ category: string; key: string; value: string }>
    }

    expect(memory.shortTerm?.recentExchanges).toEqual([
      { user: 'U2', avatar: 'A2' },
      { user: 'U3', avatar: 'A3' },
    ])
    expect(memory.workingSummary).toBe(
      'Session working summary\nAvatar (avatar_1): Avatar working summary',
    )
    expect(memory.longTermFacts).toEqual([
      { category: 'preference', key: 'tone', value: 'concise' },
    ])
  })
})

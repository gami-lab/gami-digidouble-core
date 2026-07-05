import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { GameMasterState } from '../../../domain/game-master/game-master.types.js'
import { RunGameMasterUseCase } from './run-game-master.use-case.js'

const findBySessionIdMock = vi.fn()
const saveGmStateMock = vi.fn()
const findSessionByIdMock = vi.fn()
const updateSessionMock = vi.fn()
const listAvatarsByScenarioIdMock = vi.fn()
const completeMock = vi.fn()
const traceMock = vi.fn()
const findScenarioByIdMock = vi.fn()
const findMessagesByConversationIdMock = vi.fn()
const retrieveTypedContextMock = vi.fn()

const gmStateRepository = { findBySessionId: findBySessionIdMock, save: saveGmStateMock }
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
const scenarioRepository = {
  findById: findScenarioByIdMock,
  create: vi.fn(),
  list: vi.fn(),
  delete: vi.fn(),
  update: vi.fn(),
}
const llm = { complete: completeMock }
const observability = { trace: traceMock, flush: vi.fn() }
const messageRepository = {
  create: vi.fn(),
  save: vi.fn(),
  findByConversationId: findMessagesByConversationIdMock,
  findById: vi.fn(),
  deleteByConversationId: vi.fn(),
}
const memorySelectionService = {
  select: vi.fn(),
  toGameMasterMemoryContext: vi.fn(),
}

function makeState(overrides: Partial<GameMasterState> = {}): GameMasterState {
  return {
    progression: 'progressing',
    topicsCovered: ['plastic'],
    interactionCount: 1,
    currentAvatarId: 'avatar_1',
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

function createUseCase(): RunGameMasterUseCase {
  return new RunGameMasterUseCase(
    gmStateRepository,
    sessionRepository,
    avatarRepository,
    llm,
    observability,
    scenarioRepository,
    undefined,
    undefined,
    messageRepository,
    undefined,
    memorySelectionService as never,
    { retrieve: retrieveTypedContextMock } as never,
  )
}

// eslint-disable-next-line max-lines-per-function
beforeEach(() => {
  findBySessionIdMock.mockReset()
  saveGmStateMock.mockReset()
  findSessionByIdMock.mockReset()
  updateSessionMock.mockReset()
  listAvatarsByScenarioIdMock.mockReset()
  completeMock.mockReset()
  traceMock.mockReset()
  findScenarioByIdMock.mockReset()
  findMessagesByConversationIdMock.mockReset()
  retrieveTypedContextMock.mockReset()
  memorySelectionService.select.mockReset()
  memorySelectionService.toGameMasterMemoryContext.mockReset()

  findBySessionIdMock.mockResolvedValue(makeState())
  saveGmStateMock.mockResolvedValue(undefined)
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
  listAvatarsByScenarioIdMock.mockResolvedValue([makeAvatar()])
  findScenarioByIdMock.mockResolvedValue({
    scenarioId: 'scenario_1',
    name: 'Scenario',
    status: 'active',
    objectives: [],
    worldContext: 'Storm tide starts at dusk near the harbor.',
    avatarAvailability: { initialAvatarIds: [] },
    config: {},
    createdAt: '2026-04-18T10:00:00.000Z',
    updatedAt: '2026-04-18T10:00:00.000Z',
  })
  findMessagesByConversationIdMock.mockResolvedValue([
    {
      role: 'user',
      content: 'What happened at the harbor?',
      createdAt: '2026-04-18T10:00:00.000Z',
    },
    { role: 'avatar', content: 'The docks are crowded.', createdAt: '2026-04-18T10:00:01.000Z' },
  ])
  memorySelectionService.select.mockResolvedValue({
    shortTermExchanges: [
      { user: 'What happened at the harbor?', avatar: 'The docks are crowded.' },
    ],
    workingMemory: {
      summary: 'The witness already shared a timeline contradiction.',
      unresolvedThreads: [],
      updatedAt: '2026-04-18T09:59:00.000Z',
      selectionReasons: ['working_memory', 'continuity'],
    },
    episodicMemories: [],
    longTermFacts: [],
  })
  memorySelectionService.toGameMasterMemoryContext.mockReturnValue({
    workingMemory: {
      summary: 'The witness already shared a timeline contradiction.',
      unresolvedThreads: [],
    },
  })
  retrieveTypedContextMock.mockResolvedValue({
    memory: [
      {
        sourceId: 'memory_source_1',
        chunkId: 'memory_chunk_1',
        knowledgeType: 'memory',
        content: 'The witness already shared a timeline contradiction.',
      },
    ],
    world: [
      {
        sourceId: 'world_source_1',
        chunkId: 'world_chunk_1',
        knowledgeType: 'world',
        content: 'Storm tide starts at dusk near the harbor.',
      },
    ],
    media: [
      {
        sourceId: 'media_source_1',
        chunkId: 'media_chunk_1',
        knowledgeType: 'media',
        content: 'Harbor map with dock markers.',
      },
    ],
    trace: {
      query: 'q',
      perType: {
        memory: { sourceIds: [], selectedChunkIds: [] },
        world: { sourceIds: [], selectedChunkIds: [] },
        media: { sourceIds: [], selectedChunkIds: [] },
      },
    },
  })
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

describe('RunGameMasterUseCase typed retrieval input', () => {
  it('builds GM retrieval from world context plus current exchanges and injects it into the prompt payload', async () => {
    const useCase = createUseCase()

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      conversationId: 'conversation_1',
      userMessageText: 'hello',
      turnIndex: 2,
      correlationId: 'request_gm_rag',
    })

    expect(retrieveTypedContextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query:
          'Storm tide starts at dusk near the harbor. | The witness already shared a timeline contradiction. User: What happened at the harbor? Avatar: The docks are crowded.',
        queries: [
          {
            source: 'world_context',
            text: 'Storm tide starts at dusk near the harbor.',
          },
          {
            source: 'working_memory',
            text: 'The witness already shared a timeline contradiction. User: What happened at the harbor? Avatar: The docks are crowded.',
          },
        ],
        bypassVisibilityFilter: true,
      }),
    )

    const request = completeMock.mock.calls[0]?.[0] as { messages: Array<{ content: string }> }
    const gmInput = JSON.parse(request.messages[0]?.content ?? '{}') as {
      context: {
        rag?: {
          memory?: Array<{ sourceId: string; excerpt: string }>
          world?: Array<{ sourceId: string; excerpt: string }>
          media?: Array<{ sourceId: string; excerpt: string }>
        }
      }
    }

    expect(gmInput.context.rag).toEqual({
      memory: [
        {
          sourceId: 'memory_source_1',
          excerpt: 'The witness already shared a timeline contradiction.',
        },
      ],
      world: [
        {
          sourceId: 'world_source_1',
          excerpt: 'Storm tide starts at dusk near the harbor.',
        },
      ],
      media: [
        {
          sourceId: 'media_source_1',
          excerpt: 'Harbor map with dock markers.',
        },
      ],
    })
  })
})

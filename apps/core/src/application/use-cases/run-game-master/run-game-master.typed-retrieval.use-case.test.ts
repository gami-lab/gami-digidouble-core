import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { GameMasterState } from '../../../domain/game-master/game-master.types.js'
import { readRenderedGameMasterPrompt } from '../../../test-utils/game-master.js'
import { RunGameMasterUseCase } from './run-game-master.use-case.js'

/* eslint-disable max-lines-per-function */
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
  saveComputedTraits: vi.fn(),
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
    {
      scenarioRepository,
      messageRepository,
      memorySelectionService: memorySelectionService as never,
      typedRetrievalService: { retrieve: retrieveTypedContextMock } as never,
    },
  )
}

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
      coveredTopics: [],
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
      coveredTopics: [],
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
      dialogueControl: { mode: 'avatar_guided', askFollowUp: false },
      retrievalPlan: { required: false },
      directorNotes: 'Keep the next answer focused on the current subject.',
      progressionUpdate: { progression: 'none' },
    }),
    model: 'null-model',
    inputTokens: 10,
    outputTokens: 20,
    latencyMs: 4,
  })
  traceMock.mockResolvedValue(undefined)
})

describe('RunGameMasterUseCase typed retrieval input', () => {
  it('builds GM retrieval from world context plus current exchanges and renders it under experience context', async () => {
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
    const prompt = readRenderedGameMasterPrompt(request)

    expect(prompt).toContain('## Experience Context')
    expect(prompt).toContain('### Retrieved Context')
    expect(prompt).toContain(
      '1. [memory_source_1] The witness already shared a timeline contradiction.',
    )
    expect(prompt).toContain('1. [world_source_1] Storm tide starts at dusk near the harbor.')
    expect(prompt).toContain('1. [media_source_1] Harbor map with dock markers.')
  })

  it('stores targeted repair retrieval for the Mona contradiction as next-turn orchestration', async () => {
    findMessagesByConversationIdMock.mockResolvedValue([
      { role: 'user', content: 'Où est Mona maintenant?', createdAt: '2026-07-25T10:00:00.000Z' },
      {
        role: 'avatar',
        content: 'Mona n’est plus avec nous; nous l’avons laissée derrière au chalet.',
        createdAt: '2026-07-25T10:00:01.000Z',
      },
      {
        role: 'user',
        content: 'Ta réponse est contradictoire.',
        createdAt: '2026-07-25T10:01:00.000Z',
      },
      {
        role: 'avatar',
        content: 'Tu as raison; Mona est restée chez son grand-père.',
        createdAt: '2026-07-25T10:01:01.000Z',
      },
    ])
    completeMock.mockResolvedValueOnce({
      content: JSON.stringify({
        dialogueControl: { mode: 'repair', askFollowUp: false },
        retrievalPlan: {
          required: true,
          queries: [
            'Mona current location after staying with grandfather',
            'Mona quarantine camp',
            "what Max knows about Mona's current location",
            'whether Mona was ever at the chalet',
          ],
          requiredFacts: [
            "Mona's last confirmed location",
            'whether Mona is still with her grandfather',
            'what Max knows about her current location',
            'whether Mona travelled to the chalet',
          ],
        },
        directorNotes:
          'Resolve the location issue factually before returning to the wider chalet discussion.',
        progressionUpdate: { progression: 'none' },
      }),
      model: 'null-model',
      inputTokens: 10,
      outputTokens: 20,
      latencyMs: 4,
    })

    await createUseCase().execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      conversationId: 'conversation_1',
      userMessageText: 'Ta réponse est contradictoire.',
      turnIndex: 4,
      correlationId: 'corr_mona',
    })

    const savedState = saveGmStateMock.mock.calls[0]?.[1] as GameMasterState
    const orchestration = savedState.nextTurnOrchestration
    expect(orchestration).toBeDefined()
    if (orchestration === undefined) throw new Error('Expected next-turn orchestration state')

    expect(orchestration).toMatchObject({
      activeAvatarId: 'avatar_1',
      generatedAfterTurn: 4,
      dialogueControl: { mode: 'repair', askFollowUp: false },
      retrievalPlan: {
        required: true,
      },
      directorNotes:
        'Resolve the location issue factually before returning to the wider chalet discussion.',
    })
    expect(orchestration.retrievalPlan.queries).toContain('Mona quarantine camp')
    expect(orchestration.retrievalPlan.requiredFacts).toContain(
      'what Max knows about her current location',
    )
  })
})

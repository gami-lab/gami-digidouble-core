import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { ContextEngineOutput } from '../../../domain/context/context-engine.types.js'
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
  )
}

function makeAssembledContext(): ContextEngineOutput {
  return {
    avatar: {
      avatarId: 'avatar_1',
      recentExchanges: [],
      workingMemory: {},
      longTermFacts: [],
      userPersona: null,
      gmNotes: null,
      scenario: { scenarioId: 'scenario_1' },
    },
    gm: {
      recentMessages: [{ role: 'user', content: 'What happened at the harbor?' }],
      memory: {},
      knowledge: {
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
      },
      currentState: makeState(),
      availableAvatars: [{ avatarId: 'avatar_1', name: 'Ava' }],
      userPersona: null,
      scenario: { scenarioId: 'scenario_1' },
    },
    trace: {
      deterministic: true,
      policy: {
        tokenBudget: { avatarMaxTokens: 100, gmMaxTokens: 100 },
        protectedSegments: [],
        precedence: [],
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
        avatarProjection: [],
        gmProjection: [],
      },
      selection: {
        kept: [],
        trimmed: [],
      },
    },
  }
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
    config: {},
    createdAt: '2026-04-18T10:00:00.000Z',
    updatedAt: '2026-04-18T10:00:00.000Z',
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
  it('injects GM retrieval context into the GM prompt payload when assembled context includes knowledge', async () => {
    const useCase = createUseCase()

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 2,
      correlationId: 'request_gm_rag',
      assembledContext: makeAssembledContext(),
    })

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

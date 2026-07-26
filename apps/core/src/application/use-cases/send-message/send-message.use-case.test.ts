/* eslint-disable max-lines, max-lines-per-function */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConversationEndReason } from '@gami/shared'
import type { AvatarComputedTraits } from '@gami/shared'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { Conversation, Message, Session } from '../../../domain/conversation/session.types.js'
import { expectConsoleError } from '../../../test-utils/console.js'
import type { IMemoryMaintenancePort } from '../../ports/IMemoryMaintenancePort.js'
import type { MemorySelectionService } from '../../services/memory-selection.service.js'
import type { TypedRetrievalService } from '../../services/knowledge/typed-retrieval.service.js'
import type { RunGameMasterUseCase } from '../run-game-master/run-game-master.use-case.js'
import type { GameMasterState } from '../../../domain/game-master/game-master.types.js'
import { StreamingSendMessageUseCase } from './streaming-send-message.use-case.js'
import { SendMessageUseCase } from './send-message.use-case.js'

const findSessionByIdMock = vi.fn()
const updateSessionMock = vi.fn()
const findConversationByIdMock = vi.fn()
const updateConversationMock = vi.fn()
const findAvatarByIdMock = vi.fn()
const findScenarioByIdMock = vi.fn()
const listAvatarsByScenarioIdMock = vi.fn()
const findMessagesByConversationIdMock = vi.fn()
const saveMessageMock = vi.fn()
const completeMock = vi.fn()
const streamMock = vi.fn()
const appendEventMock = vi.fn()
const runGameMasterExecuteMock = vi.fn()
const endConversationExecuteMock = vi.fn()
const findUserByIdMock = vi.fn()
const findUserFactsByUserIdMock = vi.fn()
const memoryMaintenanceExecuteMock = vi.fn()
const gmStateFindMock = vi.fn()
const gmStateSaveMock = vi.fn()

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
  update: updateConversationMock,
}

const avatarRepository = {
  findById: findAvatarByIdMock,
  create: vi.fn(),
  listByScenarioId: listAvatarsByScenarioIdMock,
  delete: vi.fn(),
  update: vi.fn(),
  saveComputedTraits: vi.fn(),
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

const llm = { complete: completeMock, stream: streamMock }
const eventLogRepository = { append: appendEventMock, findBySessionId: vi.fn() }
const userRepository = { findById: findUserByIdMock, upsert: vi.fn() }
const userMemoryFactRepository = {
  findByUserId: findUserFactsByUserIdMock,
  upsert: vi.fn(),
  findById: vi.fn(),
  deleteById: vi.fn(),
}

const SAMPLE_TRAITS: AvatarComputedTraits = {
  identity: ['Harbor archivist'],
  personality: ['Measured under pressure'],
  speakingStyle: ['Short and literal'],
  background: ['Former navigator'],
  timeline: ['Joined after the storm'],
  currentSituation: ['Guiding late arrivals'],
  behaviouralRules: ['Never fabricate ship logs'],
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

function createUseCase(
  withRunGameMaster = false,
  withUserRepository = true,
  withImplicitEnd = false,
  withUserMemoryFactRepository = false,
  withMemoryMaintenance = false,
  withGmStateRepository = false,
): SendMessageUseCase {
  const runGameMasterUseCase = toRunGameMasterUseCase(withRunGameMaster)
  const endConversationUseCase = toConversationCloser(withImplicitEnd)
  const memoryMaintenance = toMemoryMaintenance(withMemoryMaintenance)
  const gmStateRepository = withGmStateRepository
    ? {
        findBySessionId: gmStateFindMock,
        save: gmStateSaveMock,
      }
    : undefined
  return new SendMessageUseCase(
    sessionRepository,
    conversationRepository,
    avatarRepository,
    scenarioRepository,
    messageRepository,
    llm,
    eventLogRepository,
    runGameMasterUseCase,
    withUserRepository ? userRepository : undefined,
    endConversationUseCase,
    undefined,
    withUserMemoryFactRepository ? userMemoryFactRepository : undefined,
    memoryMaintenance,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    gmStateRepository,
  )
}

function toRunGameMasterUseCase(enabled: boolean): RunGameMasterUseCase | null {
  return enabled ? ({ execute: runGameMasterExecuteMock } as unknown as RunGameMasterUseCase) : null
}

function toConversationCloser(enabled: boolean): {
  execute: (input: {
    sessionId: string
    conversationId: string
    reason?: ConversationEndReason
  }) => Promise<{
    conversation: {
      conversationId: string
      sessionId: string
      avatarId: string
      status: 'active' | 'closed' | 'archived'
      startedAt: string
      lastActivityAt: string
      endedAt?: string
    }
    compaction: { scheduled: true }
  }>
} | null {
  if (!enabled) return null
  return {
    execute: endConversationExecuteMock,
  }
}

function toMemoryMaintenance(enabled: boolean): IMemoryMaintenancePort | undefined {
  return enabled
    ? ({
        execute: memoryMaintenanceExecuteMock,
        awaitPendingRefresh: vi.fn().mockResolvedValue(undefined),
      } as IMemoryMaintenancePort)
    : undefined
}

beforeEach(() => {
  findSessionByIdMock.mockReset()
  updateSessionMock.mockReset()
  findConversationByIdMock.mockReset()
  updateConversationMock.mockReset()
  findAvatarByIdMock.mockReset()
  findScenarioByIdMock.mockReset()
  listAvatarsByScenarioIdMock.mockReset()
  findMessagesByConversationIdMock.mockReset()
  saveMessageMock.mockReset()
  completeMock.mockReset()
  streamMock.mockReset()
  appendEventMock.mockReset()
  runGameMasterExecuteMock.mockReset()
  endConversationExecuteMock.mockReset()
  findUserByIdMock.mockReset()
  findUserFactsByUserIdMock.mockReset()
  memoryMaintenanceExecuteMock.mockReset()
  gmStateFindMock.mockReset()
  gmStateSaveMock.mockReset()

  findSessionByIdMock.mockResolvedValue(makeSession())
  updateSessionMock.mockResolvedValue(makeSession())
  findConversationByIdMock.mockResolvedValue(makeConversation())
  updateConversationMock.mockResolvedValue(makeConversation())
  findAvatarByIdMock.mockResolvedValue(makeAvatar())
  findScenarioByIdMock.mockResolvedValue({
    scenarioId: 'scenario_1',
    name: 'Scenario',
    status: 'active',
    objectives: [],
    worldContext: '',
    avatarAvailability: { initialAvatarIds: [] },
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
  endConversationExecuteMock.mockResolvedValue({
    conversation: {
      conversationId: 'conversation_1',
      sessionId: 'session_1',
      avatarId: 'avatar_1',
      status: 'closed',
      startedAt: '2026-04-18T10:00:00.000Z',
      lastActivityAt: '2026-04-18T10:00:02.000Z',
      endedAt: '2026-04-18T10:00:02.000Z',
    },
    compaction: { scheduled: true },
  })
  findUserByIdMock.mockResolvedValue(null)
  findUserFactsByUserIdMock.mockResolvedValue([])
  gmStateFindMock.mockResolvedValue({
    progression: '',
    topicsCovered: [],
    interactionCount: 4,
  })
  gmStateSaveMock.mockResolvedValue(undefined)
})

describe('SendMessageUseCase — message routing', () => {
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

    expect(findMessagesByConversationIdMock).toHaveBeenCalledWith('conversation_1', { limit: 30 })
    expect(saveMessageMock.mock.calls[0]?.[0]).toMatchObject({
      conversationId: 'conversation_1',
      role: 'user',
    })
    expect(saveMessageMock.mock.calls[1]?.[0]).toMatchObject({
      conversationId: 'conversation_1',
      role: 'avatar',
    })
  })
})

describe('SendMessageUseCase — llm request payload', () => {
  it('passes system prompt, messages, and trace context to the llm adapter', async () => {
    const useCase = createUseCase()

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello tracing' })

    const llmArg = completeMock.mock.calls[0]?.[0] as {
      systemPrompt?: string
      messages?: Array<{ role: string; content: string }>
      trace?: {
        requestId?: string
        sessionId?: string
        metadata?: Record<string, unknown>
      }
    }
    expect(llmArg.systemPrompt).toContain('You are Ava.')
    expect(llmArg.messages).toEqual([{ role: 'user', content: 'Hello tracing' }])
    expect(typeof llmArg.trace?.requestId).toBe('string')
    expect(llmArg.trace?.sessionId).toBe('session_1')
    expect(llmArg.trace?.metadata).toMatchObject({
      surface: 'send_message',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
    })
  })

  it('assembles the actual llm system prompt in deterministic runtime section order', async () => {
    const memorySelectionService = {
      select: vi.fn().mockResolvedValue({
        shortTermExchanges: [{ user: 'Where do I dock?', avatar: 'Follow the lantern markers.' }],
        workingMemory: {
          summary: 'The user wants concise harbor instructions.',
          unresolvedThreads: [],
          updatedAt: '2026-07-20T10:00:00.000Z',
          selectionReasons: ['working_memory', 'continuity'],
        },
        episodicMemories: [],
        longTermFacts: [{ category: 'preference', key: 'pace', value: 'quick overview' }],
      }),
      toAvatarMemorySnapshot: vi.fn().mockReturnValue({
        shortTerm: {
          exchangeCount: 1,
          recentExchanges: [{ user: 'Where do I dock?', avatar: 'Follow the lantern markers.' }],
        },
        working: {
          session: {
            summary: 'The user wants concise harbor instructions.',
            updatedAt: '2026-07-20T10:00:00.000Z',
          },
        },
        longTerm: {
          facts: [{ category: 'preference', key: 'pace', value: 'quick overview' }],
        },
      }),
    }
    const typedRetrievalService = {
      retrieve: vi.fn().mockResolvedValue({
        memory: [
          {
            sourceId: 'source_memory',
            chunkId: 'chunk_memory',
            knowledgeType: 'memory',
            content: 'The user prefers checklist-style instructions.',
          },
        ],
        world: [
          {
            sourceId: 'source_world',
            chunkId: 'chunk_world',
            knowledgeType: 'world',
            content: 'Ships dock at tidefall in this harbor.',
          },
        ],
        media: [
          {
            sourceId: 'source_media',
            chunkId: 'chunk_media',
            knowledgeType: 'media',
            content: 'Reference frame: moonlit pier diagram.',
          },
        ],
        trace: {
          query:
            'Keep the answer practical. | What should I do? | The user wants concise harbor instructions. User: Where do I dock? Avatar: Follow the lantern markers.',
          perType: {
            memory: { sourceIds: ['source_memory'], selectedChunkIds: ['chunk_memory'] },
            world: { sourceIds: ['source_world'], selectedChunkIds: ['chunk_world'] },
            media: { sourceIds: ['source_media'], selectedChunkIds: ['chunk_media'] },
          },
        },
      }),
    }
    const useCase = new SendMessageUseCase(
      sessionRepository,
      conversationRepository,
      avatarRepository,
      scenarioRepository,
      messageRepository,
      llm,
      eventLogRepository,
      null,
      userRepository,
      null,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      memorySelectionService as unknown as MemorySelectionService,
      typedRetrievalService as unknown as TypedRetrievalService,
    )
    findSessionByIdMock.mockResolvedValue(makeSession({ gmNotes: 'Keep the answer practical.' }))
    updateSessionMock.mockResolvedValue(makeSession())
    findAvatarByIdMock.mockResolvedValue(
      makeAvatar({
        name: 'Ava',
        personaPrompt: 'Legacy persona text that should not be used when traits exist.',
        adjustments: ['Use short paragraphs.'],
        computedTraits: SAMPLE_TRAITS,
      }),
    )
    findScenarioByIdMock.mockResolvedValue({
      scenarioId: 'scenario_1',
      name: 'Harbor Watch',
      status: 'active',
      objectives: ['Guide arrivals safely'],
      worldContext: 'The harbor closes at moonrise.',
      avatarAvailability: { initialAvatarIds: [] },
      config: {},
      createdAt: '2026-04-18T10:00:00.000Z',
      updatedAt: '2026-04-18T10:00:00.000Z',
    })
    listAvatarsByScenarioIdMock.mockResolvedValue([
      makeAvatar({
        name: 'Ava',
        adjustments: ['Use short paragraphs.'],
        computedTraits: SAMPLE_TRAITS,
      }),
    ])
    findUserByIdMock.mockResolvedValue({
      userId: 'user_1',
      persona: {
        name: 'Maya',
        roleInWorld: 'captain',
        dialogGuidance: 'Keep it practical.',
      },
      createdAt: '2026-04-18T10:00:00.000Z',
      updatedAt: '2026-04-18T10:00:00.000Z',
    })

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'What should I do?' })

    const llmArg = completeMock.mock.calls[0]?.[0] as { systemPrompt: string }
    expectSectionOrder(llmArg.systemPrompt, [
      '## Director Notes',
      '## Response Rules',
      '## Conversation State',
      '## User Persona',
      '## World Context',
      '## Retrieved Context',
      '## Avatar Traits',
    ])
    expect(llmArg.systemPrompt).toContain('Keep the answer practical.')
    expect(llmArg.systemPrompt).toContain('Use short paragraphs.')
    expect(llmArg.systemPrompt).toContain('Recent exchanges:')
    expect(llmArg.systemPrompt).toContain(
      'Session working memory: The user wants concise harbor instructions.',
    )
    expect(llmArg.systemPrompt).toContain('- pace: quick overview')
    expect(llmArg.systemPrompt).toContain('Name: Maya')
    expect(llmArg.systemPrompt).toContain('Role in this world: captain')
    expect(llmArg.systemPrompt).toContain('The harbor closes at moonrise.')
    expect(llmArg.systemPrompt).toContain('Memory retrieval:')
    expect(llmArg.systemPrompt).toContain('The user prefers checklist-style instructions.')
    expect(llmArg.systemPrompt).toContain('World retrieval:')
    expect(llmArg.systemPrompt).toContain('Ships dock at tidefall in this harbor.')
    expect(llmArg.systemPrompt).toContain('Media retrieval:')
    expect(llmArg.systemPrompt).toContain('Reference frame: moonlit pier diagram.')
    expect(llmArg.systemPrompt).toContain('Identity:')
    expect(llmArg.systemPrompt).toContain('- Harbor archivist')
    expect(llmArg.systemPrompt).not.toContain(
      'Legacy persona text that should not be used when traits exist.',
    )
  })

  it('emits turn_completed event payload in a non-blocking path', async () => {
    const useCase = createUseCase(true)
    findMessagesByConversationIdMock.mockResolvedValue([
      {
        messageId: 'msg_u_1',
        conversationId: 'conversation_1',
        role: 'user',
        content: 'old',
        createdAt: '2026-04-18T10:00:00.000Z',
      },
    ])

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello tracing' })
    await new Promise((resolve) => setTimeout(resolve, 0))

    const eventArg = appendEventMock.mock.calls[0]?.[0] as {
      type: string
      severity: string
      sessionId?: string
      correlationId?: string
      payload: Record<string, unknown>
    }

    expect(eventArg.type).toBe('turn_completed')
    expect(eventArg.severity).toBe('info')
    expect(eventArg.sessionId).toBe('session_1')
    expect(typeof eventArg.correlationId).toBe('string')
    expect(eventArg.payload).toMatchObject({
      conversationId: 'conversation_1',
      turnIndex: 2,
      avatarId: 'avatar_1',
      avatarContext: {
        avatarId: 'avatar_1',
        sections: {
          conversationState: {
            recentExchanges: [],
          },
          worldContext: { scenarioId: 'scenario_1' },
        },
      },
      avatarLatencyMs: 5,
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      model: 'null-model',
      hasGm: true,
    })
  })

  it('sets hasGm to false when no runGameMasterUseCase is provided', async () => {
    const useCase = createUseCase(false)

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'No gm run' })
    await new Promise((resolve) => setTimeout(resolve, 0))

    const eventArg = appendEventMock.mock.calls[0]?.[0] as {
      payload: Record<string, unknown>
    }
    expect(eventArg.payload['hasGm']).toBe(false)
    expect(eventArg.payload['avatarLatencyMs']).toBe(5)
  })

  it('does not throw when turn_completed append fails', async () => {
    const useCase = createUseCase()
    appendEventMock.mockRejectedValueOnce(new Error('event log unavailable'))

    await expectConsoleError(
      async () =>
        await useCase.execute({ conversationId: 'conversation_1', userMessage: 'still succeeds' }),
      /\[send-message\] Event log append failed for turn_completed:/,
    )
  })
})

describe('SendMessageUseCase — GM ownership', () => {
  it('does not update unlock state during avatar response generation', async () => {
    const useCase = createUseCase()
    findSessionByIdMock.mockResolvedValue(makeSession({ unlockedAvatarIds: ['avatar_1'] }))
    updateSessionMock.mockResolvedValue(makeSession({ unlockedAvatarIds: ['avatar_1'] }))
    findAvatarByIdMock.mockResolvedValue(makeAvatar({}))
    listAvatarsByScenarioIdMock.mockResolvedValue([
      makeAvatar({ avatarId: 'avatar_1' }),
      makeAvatar({ avatarId: 'avatar_2' }),
    ])
    findScenarioByIdMock.mockResolvedValue({
      scenarioId: 'scenario_1',
      name: 'AI Guided Discovery',
      status: 'active',
      objectives: [],
      worldContext: '',
      avatarAvailability: {
        initialAvatarIds: ['avatar_1'],
        unlockableAvatarIds: ['avatar_2'],
      },
      config: {},
      createdAt: '2026-04-18T10:00:00.000Z',
      updatedAt: '2026-04-18T10:00:00.000Z',
    })

    const output = await useCase.execute({
      conversationId: 'conversation_1',
      userMessage: 'How does a transformer work?',
    })

    const sessionUpdate = updateSessionMock.mock.calls[0]?.[1] as Record<string, unknown>
    expect(sessionUpdate['unlockedAvatarIds']).toBeUndefined()
    expect(output.session.unlockedAvatarIds).toEqual(['avatar_1'])
    expect(output.avatarMessage.content).not.toContain('I can introduce Theo')
  })
})

describe('SendMessageUseCase — memory maintenance', () => {
  it('triggers async working-memory refresh after completed avatar turn', async () => {
    const useCase = createUseCase(false, true, false, false, true)

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello memory' })

    expect(memoryMaintenanceExecuteMock).toHaveBeenCalledTimes(1)
    expect(memoryMaintenanceExecuteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session_1',
        conversationId: 'conversation_1',
        avatarId: 'avatar_1',
        trigger: 'post_turn',
      }),
    )
  })

  it('does not block turn success when memory maintenance fails', async () => {
    const useCase = createUseCase(false, true, false, false, true)
    memoryMaintenanceExecuteMock.mockRejectedValueOnce(new Error('refresh failed'))

    await expectConsoleError(async () => {
      await expect(
        useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello memory' }),
      ).resolves.toBeDefined()
      await Promise.resolve()
    }, /memory-maintenance/)
  })

  it('waits for a pending working-memory refresh before building the next prompt', async () => {
    let releasePending: (() => void) | undefined
    let signalPendingCalled: (() => void) | undefined
    const pendingCalled = new Promise<void>((resolve) => {
      signalPendingCalled = resolve
    })
    const awaitPendingRefresh = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          signalPendingCalled?.()
          releasePending = resolve
        }),
    )
    const memoryMaintenance: IMemoryMaintenancePort = {
      execute: memoryMaintenanceExecuteMock,
      awaitPendingRefresh,
    }
    const useCase = new SendMessageUseCase(
      sessionRepository,
      conversationRepository,
      avatarRepository,
      scenarioRepository,
      messageRepository,
      llm,
      eventLogRepository,
      null,
      userRepository,
      null,
      undefined,
      undefined,
      memoryMaintenance,
    )

    const execution = useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })

    await pendingCalled
    expect(awaitPendingRefresh).toHaveBeenCalledWith('conversation_1')
    expect(completeMock).not.toHaveBeenCalled()

    releasePending?.()

    await execution
    expect(completeMock).toHaveBeenCalledTimes(1)
  })
})

describe('SendMessageUseCase — validation and GM integration', () => {
  it('consumes matching GM orchestration once and combines its retrieval intent with the user message', async () => {
    let gmState: GameMasterState = {
      progression: 'none',
      topicsCovered: [],
      interactionCount: 1,
      nextTurnOrchestration: {
        activeAvatarId: 'avatar_1',
        generatedAfterTurn: 0,
        generatedAt: '2026-07-25T10:00:00.000Z',
        dialogueControl: { mode: 'repair', askFollowUp: false },
        retrievalPlan: {
          required: true,
          priority: 'mandatory',
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
        directorNotes: 'Resolve the contradiction before progressing.',
        progressionUpdate: { progression: 'none' },
      },
    }
    const retrieve = vi.fn().mockResolvedValue({
      memory: [],
      world: [],
      media: [],
      trace: {
        query: '',
        perType: {
          memory: {
            sourceIds: [],
            selectedChunkIds: [],
            visibility: { consideredChunkCount: 0, excludedChunkCount: 0 },
          },
          world: {
            sourceIds: [],
            selectedChunkIds: [],
            visibility: { consideredChunkCount: 0, excludedChunkCount: 0 },
          },
          media: {
            sourceIds: [],
            selectedChunkIds: [],
            visibility: { consideredChunkCount: 0, excludedChunkCount: 0 },
          },
        },
      },
    })
    const gmStateRepository = {
      findBySessionId: vi.fn().mockImplementation(() => Promise.resolve(structuredClone(gmState))),
      save: vi.fn().mockImplementation((_sessionId: string, state: GameMasterState) => {
        gmState = state
        return Promise.resolve()
      }),
    }
    const useCase = new SendMessageUseCase(
      sessionRepository,
      conversationRepository,
      avatarRepository,
      scenarioRepository,
      messageRepository,
      llm,
      eventLogRepository,
      null,
      userRepository,
      null,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { retrieve } as unknown as TypedRetrievalService,
      undefined,
      undefined,
      undefined,
      undefined,
      gmStateRepository,
    )

    await useCase.execute({
      conversationId: 'conversation_1',
      userMessage: "Is Mona still at her grandfather's house?",
    })

    const retrievalInput = retrieve.mock.calls[0]?.[0] as unknown as {
      query: string
      queries: Array<{ source: string; text: string }>
    }
    expect(retrievalInput.query).toBe(
      "Resolve the contradiction before progressing. | Mona current location after staying with grandfather | Mona quarantine camp | what Max knows about Mona's current location | whether Mona was ever at the chalet | Mona's last confirmed location | whether Mona is still with her grandfather | what Max knows about her current location | whether Mona travelled to the chalet | Is Mona still at her grandfather's house?",
    )
    expect(retrievalInput.queries).toEqual(
      expect.arrayContaining([
        {
          source: 'gm_retrieval_plan',
          text: 'Mona current location after staying with grandfather',
        },
        { source: 'gm_retrieval_plan', text: 'Mona quarantine camp' },
        { source: 'gm_retrieval_plan', text: "what Max knows about Mona's current location" },
        { source: 'gm_retrieval_plan', text: 'whether Mona was ever at the chalet' },
        { source: 'gm_retrieval_plan', text: "Mona's last confirmed location" },
        {
          source: 'gm_retrieval_plan',
          text: 'whether Mona is still with her grandfather',
        },
        {
          source: 'gm_retrieval_plan',
          text: 'what Max knows about her current location',
        },
        { source: 'gm_retrieval_plan', text: 'whether Mona travelled to the chalet' },
        { source: 'last_user_input', text: "Is Mona still at her grandfather's house?" },
      ]),
    )
    const requestUnknown: unknown = completeMock.mock.calls[0]?.[0]
    if (
      typeof requestUnknown !== 'object' ||
      requestUnknown === null ||
      typeof (requestUnknown as { systemPrompt?: unknown }).systemPrompt !== 'string'
    ) {
      throw new Error('Expected llm request with a string systemPrompt')
    }
    const request = requestUnknown as { systemPrompt: string }
    expect(request.systemPrompt).toContain('Dialogue mode: repair')
    expect(request.systemPrompt).toContain('Retrieval status: insufficient evidence.')
    expect(request.systemPrompt).toContain('Follow-up question: no')
    expect(request.systemPrompt).toContain(
      'Do not introduce a new topic until the issue is clarified.',
    )
    expect(request.systemPrompt).not.toContain('Do not add a generic follow-up question.')
    expect(gmState.nextTurnOrchestration?.consumedAfterTurn).toBe(1)
  })

  it('ignores orchestration generated for an older turn or another Avatar', async () => {
    gmStateFindMock.mockResolvedValue({
      progression: 'none',
      interactionCount: 1,
      nextTurnOrchestration: {
        activeAvatarId: 'avatar_2',
        generatedAfterTurn: 99,
        generatedAt: '2026-07-25T10:00:00.000Z',
        dialogueControl: { mode: 'repair', askFollowUp: false },
        retrievalPlan: {
          required: true,
          priority: 'mandatory',
          queries: ['stale Mona claim'],
        },
        directorNotes: 'This must not be reused.',
        progressionUpdate: { progression: 'increase' },
      },
    })

    const useCase = createUseCase(false, true, false, false, false, true)
    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'A new harbor topic.' })

    const request = completeMock.mock.calls[0]?.[0] as { systemPrompt: string }
    expect(request.systemPrompt).not.toContain('Dialogue mode: repair')
    expect(request.systemPrompt).not.toContain('This must not be reused.')
    expect(request.systemPrompt).not.toContain('stale Mona claim')
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
    expect(llmRequest.systemPrompt).toContain('## Director Notes')
    expect(llmRequest.systemPrompt).toContain('Push user deeper into examples.')
  })

  it('emits bounded runtime diagnostics without raw prompt, trait, retrieval, or credential leakage', async () => {
    const typedRetrievalService = {
      retrieve: vi.fn().mockResolvedValue({
        memory: [
          {
            sourceId: 'source_hidden',
            chunkId: 'chunk_hidden',
            knowledgeType: 'memory',
            content: 'Hidden retrieval text: sk-test-secret',
            metadata: { inlineText: 'Hidden retrieval text: sk-test-secret' },
          },
        ],
        world: [],
        media: [],
        trace: {
          query: 'secret retrieval query',
          perType: {
            memory: { sourceIds: ['source_hidden'], selectedChunkIds: ['chunk_hidden'] },
            world: { sourceIds: [], selectedChunkIds: [] },
            media: { sourceIds: [], selectedChunkIds: [] },
          },
        },
      }),
    }
    const useCase = new SendMessageUseCase(
      sessionRepository,
      conversationRepository,
      avatarRepository,
      scenarioRepository,
      messageRepository,
      llm,
      eventLogRepository,
      null,
      userRepository,
      null,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      typedRetrievalService as unknown as TypedRetrievalService,
    )
    findSessionByIdMock.mockResolvedValue(
      makeSession({ gmNotes: 'Hidden directive: ask for the vault code.' }),
    )
    findAvatarByIdMock.mockResolvedValue(
      makeAvatar({
        personaPrompt: 'Legacy secret persona text.',
        computedTraits: {
          ...SAMPLE_TRAITS,
          identity: ['Hidden trait identity'],
          behaviouralRules: ['Never reveal the vault code.'],
        },
      }),
    )

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })
    await new Promise((resolve) => setTimeout(resolve, 0))

    const llmRequest = completeMock.mock.calls[0]?.[0] as { systemPrompt: string }
    const eventArg = appendEventMock.mock.calls[0]?.[0] as { payload: Record<string, unknown> }
    const serializedPayload = JSON.stringify(eventArg.payload)

    expect(serializedPayload).not.toContain(llmRequest.systemPrompt)
    expect(serializedPayload).not.toContain('Legacy secret persona text.')
    expect(serializedPayload).not.toContain('Hidden trait identity')
    expect(serializedPayload).not.toContain('Never reveal the vault code.')
    expect(serializedPayload).not.toContain('Hidden retrieval text: sk-test-secret')
    expect(serializedPayload).not.toContain('inlineText')
    expect(serializedPayload).not.toContain('sk-test-secret')
    expect(serializedPayload).not.toContain('test-secret')
    expect(eventArg.payload['contextSelection']).toEqual({
      shortTermExchangeCount: 0,
      hasWorkingMemory: false,
      longTermFactCount: 0,
      retrieval: {
        selectedForAssemblyCounts: { memory: 1, world: 0, media: 0 },
        includedCounts: { memory: 1, world: 0, media: 0 },
        omittedByAssemblyCounts: { memory: 0, world: 0, media: 0 },
        excludedByVisibilityCounts: { memory: 0, world: 0, media: 0 },
      },
      hasUserPersona: false,
      hasGmDirective: true,
      responseRuleCount: 0,
      hasAvatarTraits: true,
    })
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
    const gmInput = runGameMasterExecuteMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(gmInput['sessionId']).toBe('session_1')
    expect(gmInput['scenarioId']).toBe('scenario_1')
    expect(gmInput['avatarId']).toBe('avatar_1')
    expect(gmInput['userMessageText']).toBe('Hello')
    expect(gmInput).not.toHaveProperty('assembledContext')
  })

  it('increments the interaction count once in application code after a completed exchange', async () => {
    const useCase = createUseCase(false, true, false, false, false, true)

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })

    expect(gmStateSaveMock).toHaveBeenCalledWith(
      'session_1',
      expect.objectContaining({ interactionCount: 5 }),
    )
  })

  it('passes selected memory payload to run game master when available', async () => {
    const useCase = createUseCase(true, true, false, true)
    findMessagesByConversationIdMock.mockResolvedValue([
      { role: 'user', content: 'Need help', createdAt: '2026-05-08T10:00:00.000Z' },
      { role: 'avatar', content: 'Sure', createdAt: '2026-05-08T10:00:01.000Z' },
    ])

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })

    const gmInput = runGameMasterExecuteMock.mock.calls[0]?.[0] as {
      selectedMemory?: { shortTermExchanges: Array<{ user: string; avatar: string }> }
    }
    expect(gmInput.selectedMemory?.shortTermExchanges).toEqual([
      { user: 'Need help', avatar: 'Sure' },
    ])
  })
})

describe('SendMessageUseCase — implicit end detection', () => {
  it('closes conversation through canonical close use case on terminal signal', async () => {
    const useCase = createUseCase(false, true, true)

    const output = await useCase.execute({ conversationId: 'conversation_1', userMessage: 'bye' })

    expect(endConversationExecuteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session_1',
        conversationId: 'conversation_1',
        reason: 'auto_terminal_signal',
      }),
    )
    expect(output.conversation.status).toBe('closed')
    expect(output.conversation.endedAt).toBeTypeOf('string')
  })

  it('does not close conversation when no implicit-end rule matches', async () => {
    const useCase = createUseCase(false, true, true)

    await useCase.execute({
      conversationId: 'conversation_1',
      userMessage: 'Tell me more details.',
    })

    expect(endConversationExecuteMock).not.toHaveBeenCalled()
  })

  it('keeps message flow successful when implicit close is skipped by race/conflict', async () => {
    const useCase = createUseCase(false, true, true)
    endConversationExecuteMock.mockRejectedValueOnce(new Error('Conversation is not active.'))

    const output = await useCase.execute({ conversationId: 'conversation_1', userMessage: 'bye' })

    expect(output.conversation.status).toBe('active')
    expect(appendEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'implicit_end_skipped',
        severity: 'warning',
      }),
    )
  })
})

describe('StreamingSendMessageUseCase', () => {
  it('persists the user first, preserves delta order, and schedules post-turn work after completion', async () => {
    const order: string[] = []
    saveMessageMock.mockImplementation((message: Message) => {
      order.push(`persist:${message.role}`)
      return Promise.resolve(message)
    })
    streamMock.mockImplementation(async function* () {
      await Promise.resolve()
      order.push('stream:start')
      yield { type: 'delta', text: 'First ' as const }
      yield { type: 'delta', text: 'second' as const }
      yield {
        type: 'completed' as const,
        response: {
          content: 'provider fallback',
          model: 'stream-model',
          inputTokens: 3,
          outputTokens: 2,
          latencyMs: 8,
        },
      }
    })
    runGameMasterExecuteMock.mockImplementation(() => {
      order.push('gm:scheduled')
      return Promise.resolve()
    })

    const streamingUseCase = new StreamingSendMessageUseCase(createUseCase(true))
    const stream = streamingUseCase.execute({
      conversationId: 'conversation_1',
      userMessage: 'Hello',
    })
    const iterator = stream[Symbol.asyncIterator]()

    const started = await iterator.next()
    const firstDelta = await iterator.next()
    const secondDelta = await iterator.next()
    const completed = await iterator.next()

    expect(started.value).toMatchObject({ type: 'started' })
    expect(firstDelta.value).toMatchObject({ type: 'delta', sequence: 0, delta: 'First ' })
    expect(secondDelta.value).toMatchObject({ type: 'delta', sequence: 1, delta: 'second' })
    expect(completed.value).toMatchObject({
      type: 'completed',
      output: { avatarMessage: { content: 'First second' } },
    })
    expect(saveMessageMock.mock.calls.map(([message]) => (message as Message).role)).toEqual([
      'user',
      'avatar',
    ])
    expect(order.indexOf('persist:user')).toBeLessThan(order.indexOf('stream:start'))
    expect(runGameMasterExecuteMock).not.toHaveBeenCalled()

    const done = await iterator.next()

    expect(done.done).toBe(true)
    expect(runGameMasterExecuteMock).toHaveBeenCalledTimes(1)
    expect(order.indexOf('gm:scheduled')).toBeGreaterThan(order.indexOf('persist:avatar'))
  })

  it('persists the completed avatar message exactly once', async () => {
    streamMock.mockImplementation(async function* () {
      await Promise.resolve()
      yield { type: 'delta', text: 'Answer' as const }
      yield {
        type: 'completed' as const,
        response: {
          content: 'provider fallback',
          model: 'stream-model',
          inputTokens: 3,
          outputTokens: 2,
          latencyMs: 8,
        },
      }
      yield {
        type: 'completed' as const,
        response: {
          content: 'duplicate terminal',
          model: 'stream-model',
          inputTokens: 3,
          outputTokens: 2,
          latencyMs: 8,
        },
      }
    })

    const events = []
    for await (const event of new StreamingSendMessageUseCase(createUseCase()).execute({
      conversationId: 'conversation_1',
      userMessage: 'Hello',
    })) {
      events.push(event)
    }

    expect(events.map((event) => event.type)).toEqual(['started', 'delta', 'completed'])
    expect(saveMessageMock.mock.calls.map(([message]) => (message as Message).role)).toEqual([
      'user',
      'avatar',
    ])
  })

  it('closes the provider iterator when the consumer aborts before completion', async () => {
    let iteratorClosed = false
    streamMock.mockImplementation(() => {
      const stream = {
        next() {
          return Promise.resolve({
            done: false as const,
            value: { type: 'delta' as const, text: 'Partial' },
          })
        },
        return() {
          iteratorClosed = true
          return Promise.resolve({ done: true as const, value: undefined })
        },
        [Symbol.asyncIterator]() {
          return this
        },
      }
      return stream
    })

    const streamingUseCase = new StreamingSendMessageUseCase(createUseCase())
    const stream = streamingUseCase.execute({
      conversationId: 'conversation_1',
      userMessage: 'Hello',
    })
    const iterator = stream[Symbol.asyncIterator]()

    await iterator.next()
    await iterator.next()
    await iterator.return?.()

    expect(iteratorClosed).toBe(true)
    expect(saveMessageMock.mock.calls.map(([message]) => (message as Message).role)).toEqual([
      'user',
    ])
  })

  it('keeps the user message on provider interruption and does not persist a partial avatar', async () => {
    streamMock.mockImplementation(async function* () {
      await Promise.resolve()
      yield { type: 'delta', text: 'Partial' as const }
      throw Object.assign(new Error('provider aborted'), { name: 'AbortError' })
    })

    const streamingUseCase = new StreamingSendMessageUseCase(createUseCase(true))
    const events = []
    for await (const event of streamingUseCase.execute({
      conversationId: 'conversation_1',
      userMessage: 'Hello',
    })) {
      events.push(event)
    }

    expect(events.map((event) => event.type)).toEqual(['started', 'delta', 'interrupted'])
    expect(events.at(-1)).toMatchObject({ type: 'interrupted', reason: 'provider_aborted' })
    expect(saveMessageMock.mock.calls.map(([message]) => (message as Message).role)).toEqual([
      'user',
    ])
    expect(runGameMasterExecuteMock).not.toHaveBeenCalled()
  })

  it('reports client interruption and skips final persistence after the signal is aborted', async () => {
    const controller = new AbortController()
    streamMock.mockImplementation(async function* () {
      await Promise.resolve()
      yield { type: 'delta', text: 'Partial' as const }
      controller.abort()
      throw new Error('request cancelled')
    })

    const streamingUseCase = new StreamingSendMessageUseCase(createUseCase(true))
    const events = []
    for await (const event of streamingUseCase.execute(
      { conversationId: 'conversation_1', userMessage: 'Hello' },
      { signal: controller.signal },
    )) {
      events.push(event)
    }

    expect(events.at(-1)).toMatchObject({ type: 'interrupted', reason: 'client_aborted' })
    expect(saveMessageMock).toHaveBeenCalledTimes(1)
    expect(runGameMasterExecuteMock).not.toHaveBeenCalled()
  })
})

function expectSectionOrder(prompt: string, sections: string[]): void {
  let previousIndex = -1
  for (const section of sections) {
    const currentIndex = prompt.indexOf(section)
    expect(currentIndex).toBeGreaterThan(previousIndex)
    previousIndex = currentIndex
  }
}

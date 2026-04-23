import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type {
  GameMasterInput,
  GameMasterState,
} from '../../../domain/game-master/game-master.types.js'
import { expectConsoleError } from '../../../test-utils/console.js'
import { RunGameMasterUseCase } from './run-game-master.use-case.js'

const findBySessionIdMock = vi.fn()
const saveGmStateMock = vi.fn()
const updateSessionMock = vi.fn()
const listAvatarsByScenarioIdMock = vi.fn()
const findActiveBySessionIdMock = vi.fn()
const createConversationMock = vi.fn()
const updateConversationMock = vi.fn()
const completeMock = vi.fn()
const traceMock = vi.fn()

const gmStateRepository = {
  findBySessionId: findBySessionIdMock,
  save: saveGmStateMock,
}

const sessionRepository = {
  findById: vi.fn(),
  create: vi.fn(),
  update: updateSessionMock,
  delete: vi.fn(),
  countByScenarioId: vi.fn(),
  countActiveByScenarioId: vi.fn(),
}

const avatarRepository = {
  findById: vi.fn(),
  create: vi.fn(),
  listByScenarioId: listAvatarsByScenarioIdMock,
  delete: vi.fn(),
}

const llm = { complete: completeMock }
const observability = { trace: traceMock, flush: vi.fn() }

const conversationRepository = {
  findById: vi.fn(),
  findActiveBySessionId: findActiveBySessionIdMock,
  create: createConversationMock,
  listBySessionId: vi.fn(),
  update: updateConversationMock,
}

function makeState(overrides: Partial<GameMasterState> = {}): GameMasterState {
  return {
    progression: 'none',
    topicsCovered: ['plastic'],
    interactionCount: 5,
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

function makeScenarioRepository(config: Record<string, unknown>) {
  return {
    findById: vi.fn().mockResolvedValue({
      scenarioId: 'scenario_1',
      name: 'Scenario',
      status: 'active',
      config,
      createdAt: '',
      updatedAt: '',
    }),
    create: vi.fn(),
    list: vi.fn(),
    delete: vi.fn(),
  }
}

function createUseCase(options?: {
  scenarioRepository?: ReturnType<typeof makeScenarioRepository>
  withConversationRepository?: boolean
}): RunGameMasterUseCase {
  return new RunGameMasterUseCase(
    gmStateRepository,
    sessionRepository,
    avatarRepository,
    llm,
    observability,
    options?.scenarioRepository,
    undefined,
    options?.withConversationRepository === false ? undefined : conversationRepository,
  )
}

function mockTriggeredLlmOutput(content: Record<string, unknown>): void {
  completeMock.mockResolvedValue({
    content: JSON.stringify(content),
    model: 'null-model',
    inputTokens: 10,
    outputTokens: 20,
    latencyMs: 4,
  })
}

function parseGameMasterInputFromLlmCall(): GameMasterInput {
  const firstCall = completeMock.mock.calls[0]?.[0] as
    | { messages: Array<{ content: string }> }
    | undefined
  if (firstCall === undefined) {
    throw new Error('Expected llm.complete to be called at least once.')
  }
  const payload = JSON.parse(firstCall.messages[0]?.content ?? 'null') as unknown
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Expected JSON payload object in llm input.')
  }
  return payload as GameMasterInput
}

beforeEach(() => {
  findBySessionIdMock.mockReset()
  saveGmStateMock.mockReset()
  updateSessionMock.mockReset()
  listAvatarsByScenarioIdMock.mockReset()
  findActiveBySessionIdMock.mockReset()
  createConversationMock.mockReset()
  updateConversationMock.mockReset()
  completeMock.mockReset()
  traceMock.mockReset()

  findBySessionIdMock.mockResolvedValue(makeState())
  saveGmStateMock.mockResolvedValue(undefined)
  updateSessionMock.mockResolvedValue(undefined)
  listAvatarsByScenarioIdMock.mockResolvedValue([
    makeAvatar({ avatarId: 'avatar_1' }),
    makeAvatar({ avatarId: 'avatar_2', name: 'Nova' }),
  ])
  findActiveBySessionIdMock.mockResolvedValue({
    conversationId: 'conversation_old',
    sessionId: 'session_1',
    avatarId: 'avatar_1',
    status: 'active',
    startedAt: '2026-04-21T08:00:00.000Z',
    lastActivityAt: '2026-04-21T08:00:00.000Z',
  })
  updateConversationMock.mockResolvedValue(undefined)
  createConversationMock.mockResolvedValue(undefined)
  traceMock.mockResolvedValue(undefined)
})

describe('RunGameMasterUseCase — avatar switch flow (happy/no-op paths)', () => {
  it('conversationMode new with valid nextAvatarId closes old conversation and creates a new one', async () => {
    const useCase = createUseCase({
      scenarioRepository: makeScenarioRepository({
        avatarTransitionRules: [
          {
            fromAvatarId: 'avatar_1',
            toAvatarId: 'avatar_2',
            trigger: 'progression',
          },
        ],
      }),
    })
    mockTriggeredLlmOutput({
      avatarId: 'avatar_1',
      nextAvatarId: 'avatar_2',
      transitionReason: 'progression_handoff',
      conversationMode: 'new',
      context: { notes: 'Handoff to avatar 2 with a short recap.' },
      stateUpdate: { interactionIncrement: 1 },
    })

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 6,
      correlationId: 'corr_1',
    })

    expect(updateConversationMock).toHaveBeenCalledTimes(1)
    const closeCall = updateConversationMock.mock.calls[0] as
      | [string, { status?: string; endedAt?: string }]
      | undefined
    expect(closeCall?.[0]).toBe('conversation_old')
    expect(closeCall?.[1].status).toBe('closed')
    expect(typeof closeCall?.[1].endedAt).toBe('string')
    expect(createConversationMock).toHaveBeenCalledWith({
      sessionId: 'session_1',
      avatarId: 'avatar_2',
      startedBy: 'gm',
      reason: 'progression_handoff',
      handoffFromConversationId: 'conversation_old',
    })
    expect(updateSessionMock).toHaveBeenCalledWith('session_1', { activeAvatarId: 'avatar_2' })
  })

  it('conversationMode new without conversation repository is a graceful no-op switch path', async () => {
    const useCase = createUseCase({ withConversationRepository: false })
    mockTriggeredLlmOutput({
      avatarId: 'avatar_1',
      nextAvatarId: 'avatar_2',
      conversationMode: 'new',
      stateUpdate: { interactionIncrement: 1 },
    })

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 6,
      correlationId: 'corr_2',
    })

    expect(createConversationMock).not.toHaveBeenCalled()
    expect(updateConversationMock).not.toHaveBeenCalled()
  })
})

describe('RunGameMasterUseCase — avatar switch flow (guard rails)', () => {
  it('conversationMode new with nextAvatarId outside eligible set skips switch', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const useCase = createUseCase({
      scenarioRepository: makeScenarioRepository({
        avatarTransitionRules: [
          {
            fromAvatarId: 'avatar_1',
            toAvatarId: 'avatar_2',
            trigger: 'progression',
          },
        ],
      }),
    })
    mockTriggeredLlmOutput({
      avatarId: 'avatar_1',
      nextAvatarId: 'avatar_3',
      conversationMode: 'new',
      stateUpdate: { interactionIncrement: 1 },
    })

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 6,
      correlationId: 'corr_3',
    })

    expect(createConversationMock).not.toHaveBeenCalled()
    expect(updateConversationMock).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      '[GM] Skipping avatar switch: nextAvatarId is not in eligible transitions.',
      'avatar_3',
      ['avatar_2'],
    )
    warnSpy.mockRestore()
  })

  it('conversationMode continue does not create a new conversation', async () => {
    const useCase = createUseCase()
    mockTriggeredLlmOutput({
      avatarId: 'avatar_1',
      nextAvatarId: 'avatar_2',
      conversationMode: 'continue',
      stateUpdate: { interactionIncrement: 1 },
    })

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 6,
      correlationId: 'corr_4',
    })

    expect(createConversationMock).not.toHaveBeenCalled()
  })

  it('swallows performAvatarSwitch internal errors without propagating', async () => {
    const useCase = createUseCase({
      scenarioRepository: makeScenarioRepository({
        avatarTransitionRules: [
          {
            fromAvatarId: 'avatar_1',
            toAvatarId: 'avatar_2',
            trigger: 'progression',
          },
        ],
      }),
    })
    updateConversationMock.mockRejectedValue(new Error('db write failed'))
    mockTriggeredLlmOutput({
      avatarId: 'avatar_1',
      nextAvatarId: 'avatar_2',
      conversationMode: 'new',
      stateUpdate: { interactionIncrement: 1 },
    })

    await expectConsoleError(
      () =>
        useCase.execute({
          sessionId: 'session_1',
          scenarioId: 'scenario_1',
          avatarId: 'avatar_1',
          userMessageText: 'hello',
          turnIndex: 6,
          correlationId: 'corr_5',
        }),
      /\[GM\] Avatar switch failed:/,
    )
  })
})

describe('RunGameMasterUseCase — eligible transitions context', () => {
  it('passes eligible transitions into GameMasterInput context', async () => {
    const useCase = createUseCase({
      scenarioRepository: makeScenarioRepository({
        avatarTransitionRules: [
          {
            fromAvatarId: 'avatar_1',
            toAvatarId: 'avatar_2',
            trigger: 'topic_repeat',
            topic: 'plastic',
          },
        ],
      }),
    })
    findBySessionIdMock.mockResolvedValue(
      makeState({
        progression: 'progressing',
        interactionCount: 1,
        topicsCovered: ['plastic', 'plastic', 'plastic'],
      }),
    )
    mockTriggeredLlmOutput({
      avatarId: 'avatar_1',
      conversationMode: 'continue',
      stateUpdate: { interactionIncrement: 1 },
    })

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 2,
      correlationId: 'corr_6',
    })

    const gmInput = parseGameMasterInputFromLlmCall()
    expect(gmInput.context.eligibleTransitions).toEqual([
      {
        toAvatarId: 'avatar_2',
        reason: 'topic_rule:plastic:avatar_1→avatar_2',
      },
    ])
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { GameMasterState } from '../../../domain/game-master/game-master.types.js'
import { RunGameMasterUseCase } from './run-game-master.use-case.js'

const findBySessionIdMock = vi.fn()
const saveGmStateMock = vi.fn()
const findSessionByIdMock = vi.fn()
const updateSessionMock = vi.fn()
const listAvatarsByScenarioIdMock = vi.fn()
const findActiveBySessionIdMock = vi.fn()
const createConversationMock = vi.fn()
const updateConversationMock = vi.fn()
const completeMock = vi.fn()
const traceMock = vi.fn()

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
const conversationRepository = {
  findById: vi.fn(),
  findActiveBySessionId: findActiveBySessionIdMock,
  create: createConversationMock,
  listBySessionId: vi.fn(),
  deleteBySessionId: vi.fn(),
  update: updateConversationMock,
}
const llm = { complete: completeMock }
const observability = { trace: traceMock, flush: vi.fn() }

function makeState(overrides: Partial<GameMasterState> = {}): GameMasterState {
  return {
    progression: 'none',
    topicsCovered: [],
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
    undefined,
    undefined,
    conversationRepository,
  )
}

function mockGmOutput(content: Record<string, unknown>): void {
  completeMock.mockResolvedValue({
    content: JSON.stringify({
      directorNotes: 'Keep the next answer focused on the current subject.',
      ...content,
    }),
    model: 'null-model',
    inputTokens: 10,
    outputTokens: 20,
    latencyMs: 4,
  })
}

beforeEach(() => {
  findBySessionIdMock.mockReset()
  saveGmStateMock.mockReset()
  findSessionByIdMock.mockReset()
  updateSessionMock.mockReset()
  listAvatarsByScenarioIdMock.mockReset()
  findActiveBySessionIdMock.mockReset()
  createConversationMock.mockReset()
  updateConversationMock.mockReset()
  completeMock.mockReset()
  traceMock.mockReset()

  findBySessionIdMock.mockResolvedValue(makeState())
  saveGmStateMock.mockResolvedValue(undefined)
  findSessionByIdMock.mockResolvedValue({
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    activeAvatarId: 'avatar_1',
    unlockedAvatarIds: ['avatar_1', 'avatar_2'],
    status: 'active',
    startedAt: '2026-04-18T10:00:00.000Z',
    lastActivityAt: '2026-04-18T10:00:00.000Z',
  })
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

describe('RunGameMasterUseCase — async avatar switch safety', () => {
  it('sets a valid routed Avatar as the next active Avatar without switching the current conversation', async () => {
    const useCase = createUseCase()
    mockGmOutput({
      dialogueControl: { mode: 'transition', askFollowUp: false },
      retrievalPlan: { required: false },
      routing: { action: 'switch', avatarId: 'avatar_2', reason: 'specialist_handoff' },
      progressionUpdate: { progression: 'none' },
    })

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 2,
      correlationId: 'corr_1',
    })

    expect(updateConversationMock).not.toHaveBeenCalled()
    expect(createConversationMock).not.toHaveBeenCalled()
    expect(updateSessionMock).toHaveBeenCalledWith('session_1', { activeAvatarId: 'avatar_2' })
  })

  it('does not switch even when the routed avatarId is locked', async () => {
    const useCase = createUseCase()
    findSessionByIdMock.mockResolvedValue({
      sessionId: 'session_1',
      userId: 'user_1',
      scenarioId: 'scenario_1',
      activeAvatarId: 'avatar_1',
      unlockedAvatarIds: ['avatar_1'],
      status: 'active',
      startedAt: '2026-04-18T10:00:00.000Z',
      lastActivityAt: '2026-04-18T10:00:00.000Z',
    })
    mockGmOutput({
      dialogueControl: { mode: 'transition', askFollowUp: false },
      retrievalPlan: { required: false },
      routing: { action: 'switch', avatarId: 'avatar_2' },
      progressionUpdate: { progression: 'none' },
    })

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 2,
      correlationId: 'corr_2',
    })

    expect(updateConversationMock).not.toHaveBeenCalled()
    expect(createConversationMock).not.toHaveBeenCalled()
  })
})

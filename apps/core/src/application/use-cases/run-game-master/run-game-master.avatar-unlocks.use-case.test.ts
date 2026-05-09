import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { GameMasterState } from '../../../domain/game-master/game-master.types.js'
import { InMemoryEventLogRepository } from '../../../infrastructure/db/in-memory-event-log.repository.js'
import { RunGameMasterUseCase } from './run-game-master.use-case.js'

const findBySessionIdMock = vi.fn()
const saveGmStateMock = vi.fn()
const findSessionByIdMock = vi.fn()
const updateSessionMock = vi.fn()
const listAvatarsByScenarioIdMock = vi.fn()
const findMessagesByConversationIdMock = vi.fn()
const saveMessageMock = vi.fn()
const deleteMessagesByConversationIdMock = vi.fn()
const completeMock = vi.fn()
const traceMock = vi.fn()

const gmStateRepository = {
  findBySessionId: findBySessionIdMock,
  save: saveGmStateMock,
}

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

const llm = { complete: completeMock }
const observability = { trace: traceMock, flush: vi.fn() }
const messageRepository = {
  findByConversationId: findMessagesByConversationIdMock,
  save: saveMessageMock,
  deleteByConversationId: deleteMessagesByConversationIdMock,
}

function makeState(overrides: Partial<GameMasterState> = {}): GameMasterState {
  return {
    progression: 'progressing',
    topicsCovered: [],
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

function makeSession(unlockedAvatarIds: string[]) {
  return {
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    activeAvatarId: 'avatar_1',
    unlockedAvatarIds,
    status: 'active' as const,
    startedAt: '2026-04-18T10:00:00.000Z',
    lastActivityAt: '2026-04-18T10:00:00.000Z',
  }
}

function createUseCase(eventLog?: InMemoryEventLogRepository): RunGameMasterUseCase {
  return new RunGameMasterUseCase(
    gmStateRepository,
    sessionRepository,
    avatarRepository,
    llm,
    observability,
    undefined,
    eventLog,
    undefined,
    messageRepository,
  )
}

function mockGmOutput(output: Record<string, unknown>): void {
  completeMock.mockResolvedValue({
    content: JSON.stringify(output),
    model: 'null-model',
    inputTokens: 10,
    outputTokens: 20,
    latencyMs: 4,
  })
}

async function executeGm(useCase: RunGameMasterUseCase): Promise<void> {
  await useCase.execute({
    sessionId: 'session_1',
    scenarioId: 'scenario_1',
    avatarId: 'avatar_1',
    conversationId: 'conversation_1',
    userMessageText: 'hello',
    turnIndex: 2,
    correlationId: 'corr_unlock',
  })
}

beforeEach(() => {
  findBySessionIdMock.mockReset()
  saveGmStateMock.mockReset()
  findSessionByIdMock.mockReset()
  updateSessionMock.mockReset()
  listAvatarsByScenarioIdMock.mockReset()
  findMessagesByConversationIdMock.mockReset()
  saveMessageMock.mockReset()
  deleteMessagesByConversationIdMock.mockReset()
  completeMock.mockReset()
  traceMock.mockReset()

  findBySessionIdMock.mockResolvedValue(makeState())
  saveGmStateMock.mockResolvedValue(undefined)
  findSessionByIdMock.mockResolvedValue(makeSession(['avatar_1']))
  updateSessionMock.mockResolvedValue(undefined)
  listAvatarsByScenarioIdMock.mockResolvedValue([
    makeAvatar({ avatarId: 'avatar_1' }),
    makeAvatar({ avatarId: 'avatar_2', name: 'Theo' }),
  ])
  findMessagesByConversationIdMock.mockResolvedValue([])
  saveMessageMock.mockResolvedValue(undefined)
  deleteMessagesByConversationIdMock.mockResolvedValue(0)
  traceMock.mockResolvedValue(undefined)
})

describe('RunGameMasterUseCase — avatar unlock decisions', () => {
  it('updates session unlockedAvatarIds from valid GM unlock output without duplicates', async () => {
    const eventLog = new InMemoryEventLogRepository()
    const useCase = createUseCase(eventLog)
    findMessagesByConversationIdMock.mockResolvedValue([
      {
        messageId: 'msg_1',
        conversationId: 'conversation_1',
        role: 'user',
        content: 'Can Theo explain the technical side?',
        createdAt: '2026-04-20T10:00:00.000Z',
      },
      {
        messageId: 'msg_1b',
        conversationId: 'conversation_1',
        role: 'avatar',
        content: 'Yes, Theo can help with technical details.',
        createdAt: '2026-04-20T10:00:01.000Z',
      },
    ])
    mockGmOutput({
      avatarId: 'avatar_1',
      unlockAvatarIds: ['avatar_2', 'avatar_2'],
      suggestedAvatarId: 'avatar_2',
      suggestedAvatarReason: 'Technical specialist is now relevant.',
      conversationMode: 'continue',
      stateUpdate: { interactionIncrement: 1 },
    })

    await executeGm(useCase)

    expect(updateSessionMock).toHaveBeenCalledWith('session_1', {
      unlockedAvatarIds: ['avatar_1', 'avatar_2'],
    })
    expect(eventLog.getAll()[0]?.payload['decision']).toMatchObject({
      unlockedAvatarIds: ['avatar_2'],
      suggestedAvatarId: 'avatar_2',
      suggestedAvatarReason: 'Technical specialist is now relevant.',
    })
  })

  it('ignores invalid and non-scenario avatar IDs from GM unlock output', async () => {
    const useCase = createUseCase()
    mockGmOutput({
      avatarId: 'avatar_1',
      unlockAvatarIds: ['avatar_1', 'avatar_missing'],
      conversationMode: 'continue',
      stateUpdate: { interactionIncrement: 1 },
    })

    await executeGm(useCase)

    expect(hasUnlockUpdate()).toBe(false)
  })

  it('does not unlock locked avatars that were not mentioned in recent discussion', async () => {
    const useCase = createUseCase()
    findMessagesByConversationIdMock.mockResolvedValue([
      {
        messageId: 'msg_2',
        conversationId: 'conversation_1',
        role: 'user',
        content: 'Please continue with the current guide.',
        createdAt: '2026-04-20T10:01:00.000Z',
      },
      {
        messageId: 'msg_2b',
        conversationId: 'conversation_1',
        role: 'avatar',
        content: 'Sure, we can continue.',
        createdAt: '2026-04-20T10:01:01.000Z',
      },
    ])
    mockGmOutput({
      avatarId: 'avatar_1',
      unlockAvatarIds: ['avatar_2'],
      conversationMode: 'continue',
      stateUpdate: { interactionIncrement: 1 },
    })

    await executeGm(useCase)

    expect(hasUnlockUpdate()).toBe(false)
  })

  it('does not unlock when GM output has no unlock decision', async () => {
    const useCase = createUseCase()
    mockGmOutput({
      avatarId: 'avatar_1',
      conversationMode: 'continue',
      stateUpdate: { interactionIncrement: 1 },
    })

    await executeGm(useCase)

    expect(hasUnlockUpdate()).toBe(false)
  })
})

function hasUnlockUpdate(): boolean {
  return updateSessionMock.mock.calls.some((call) => {
    const updates = call[1] as Record<string, unknown>
    return updates['unlockedAvatarIds'] !== undefined
  })
}

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { Conversation, Session } from '../../../domain/conversation/session.types.js'
import { InMemoryConversationWorkingMemoryRepository } from '../../../infrastructure/db/in-memory-conversation-working-memory.repository.js'
import { expectConsoleError } from '../../../test-utils/console.js'
import type { RunGameMasterUseCase } from '../run-game-master/run-game-master.use-case.js'
import { StartConversationUseCase } from './start-conversation.use-case.js'

const findSessionByIdMock = vi.fn()
const updateSessionMock = vi.fn()
const findAvatarByIdMock = vi.fn()
const findActiveBySessionIdMock = vi.fn()
const createConversationMock = vi.fn()
const updateConversationMock = vi.fn()
const appendEventMock = vi.fn()
const findGmStateBySessionIdMock = vi.fn()
const saveGmStateMock = vi.fn()

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
  findById: findAvatarByIdMock,
  create: vi.fn(),
  listByScenarioId: vi.fn(),
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

const gmStateRepository = {
  findBySessionId: findGmStateBySessionIdMock,
  save: saveGmStateMock,
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
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

beforeEach(() => {
  findSessionByIdMock.mockReset()
  updateSessionMock.mockReset()
  findAvatarByIdMock.mockReset()
  findActiveBySessionIdMock.mockReset()
  createConversationMock.mockReset()
  updateConversationMock.mockReset()
  appendEventMock.mockReset()
  findGmStateBySessionIdMock.mockReset()
  saveGmStateMock.mockReset()

  findSessionByIdMock.mockResolvedValue(makeSession())
  updateSessionMock.mockResolvedValue(makeSession())
  findAvatarByIdMock.mockResolvedValue(makeAvatar())
  findActiveBySessionIdMock.mockResolvedValue(null) // no prior conversation by default
  createConversationMock.mockResolvedValue(makeConversation())
  updateConversationMock.mockResolvedValue(makeConversation())
  findGmStateBySessionIdMock.mockResolvedValue({
    currentAvatarId: 'avatar_legacy',
    progression: 'advanced',
    topicsCovered: ['setup'],
    interactionCount: 9,
  })
  saveGmStateMock.mockResolvedValue(undefined)
})

function makeUseCaseWithPipeline(
  generateForClosedConversation: ReturnType<typeof vi.fn>,
  memoryMaintenance: { execute: ReturnType<typeof vi.fn> },
): StartConversationUseCase {
  const hydrate = vi.fn().mockResolvedValue({
    hydration: { summary: '', coveredTopics: [], unresolvedThreads: [], candidateFacts: [] },
    selectedConversationIds: [],
    consideredConversationIds: [],
  })
  return new StartConversationUseCase(
    sessionRepository,
    avatarRepository,
    conversationRepository,
    undefined,
    { hydrateForNewConversationWithMetadata: hydrate, generateForClosedConversation },
    undefined,
    memoryMaintenance,
  )
}

// eslint-disable-next-line max-lines-per-function
describe('StartConversationUseCase', () => {
  it('creates a conversation with the requested avatar', async () => {
    const useCase = new StartConversationUseCase(
      sessionRepository,
      avatarRepository,
      conversationRepository,
    )

    const output = await useCase.execute({ sessionId: 'session_1', avatarId: 'avatar_1' })

    expect(createConversationMock).toHaveBeenCalledWith({
      sessionId: 'session_1',
      avatarId: 'avatar_1',
      startedBy: 'user',
    })
    expect(output.conversation.avatarId).toBe('avatar_1')
  })

  it('updates session active avatar when conversation starts', async () => {
    const useCase = new StartConversationUseCase(
      sessionRepository,
      avatarRepository,
      conversationRepository,
    )

    await useCase.execute({ sessionId: 'session_1', avatarId: 'avatar_1' })

    expect(updateSessionMock).toHaveBeenCalledWith(
      'session_1',
      expect.objectContaining({ activeAvatarId: 'avatar_1' }),
    )
  })

  it('syncs gm currentAvatarId when conversation starts', async () => {
    const useCase = new StartConversationUseCase(
      sessionRepository,
      avatarRepository,
      conversationRepository,
      undefined,
      undefined,
      undefined,
      undefined,
      gmStateRepository,
    )

    await useCase.execute({ sessionId: 'session_1', avatarId: 'avatar_1' })

    expect(saveGmStateMock).toHaveBeenCalledWith('session_1', {
      currentAvatarId: 'avatar_1',
      progression: 'advanced',
      interactionCount: 9,
    })
  })

  it('rejects avatar from another scenario', async () => {
    const useCase = new StartConversationUseCase(
      sessionRepository,
      avatarRepository,
      conversationRepository,
    )
    findAvatarByIdMock.mockResolvedValue(makeAvatar({ scenarioId: 'scenario_2' }))

    await expect(
      useCase.execute({ sessionId: 'session_1', avatarId: 'avatar_1' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('rejects locked avatars when session unlock state is present', async () => {
    const useCase = new StartConversationUseCase(
      sessionRepository,
      avatarRepository,
      conversationRepository,
    )
    findSessionByIdMock.mockResolvedValue(makeSession({ unlockedAvatarIds: ['avatar_guide'] }))

    await expect(
      useCase.execute({ sessionId: 'session_1', avatarId: 'avatar_1' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('hydrates initial working memory from episodic memories on conversation start', async () => {
    const conversationWorkingMemoryRepository = new InMemoryConversationWorkingMemoryRepository()
    const hydrateForNewConversationWithMetadata = vi.fn().mockResolvedValue({
      hydration: {
        summary: 'Hydrated summary',
        coveredTopics: ['benchmark_scope'],
        unresolvedThreads: ['Need benchmark'],
        candidateFacts: [{ category: 'conversation_signal', key: 'k1', value: 'Need benchmark' }],
      },
      selectedConversationIds: ['conversation_legacy_1'],
      consideredConversationIds: ['conversation_legacy_1', 'conversation_legacy_2'],
    })
    const useCase = new StartConversationUseCase(
      sessionRepository,
      avatarRepository,
      conversationRepository,
      conversationWorkingMemoryRepository,
      {
        hydrateForNewConversationWithMetadata,
        generateForClosedConversation: vi.fn().mockResolvedValue(undefined),
      },
      { append: appendEventMock, findBySessionId: vi.fn() },
    )

    await useCase.execute({ sessionId: 'session_1', avatarId: 'avatar_1' })

    expect(hydrateForNewConversationWithMetadata).toHaveBeenCalledTimes(1)
    await expect(
      conversationWorkingMemoryRepository.findByConversationId('conversation_1'),
    ).resolves.toMatchObject({
      summary: 'Hydrated summary',
    })
    expect(appendEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'memory_hydration_succeeded',
        sessionId: 'session_1',
      }),
    )
  })
})

describe('StartConversationUseCase initial GM run', () => {
  it('dispatches a GM run for the new conversation before any user message exists', async () => {
    const runGameMasterExecuteMock = vi.fn().mockResolvedValue(undefined)
    const useCase = new StartConversationUseCase(
      sessionRepository,
      avatarRepository,
      conversationRepository,
      undefined,
      undefined,
      undefined,
      undefined,
      gmStateRepository,
      { execute: runGameMasterExecuteMock } as unknown as RunGameMasterUseCase,
    )

    await useCase.execute({ sessionId: 'session_1', avatarId: 'avatar_1' })

    await vi.waitFor(() => {
      expect(runGameMasterExecuteMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session_1',
          scenarioId: 'scenario_1',
          avatarId: 'avatar_1',
          conversationId: 'conversation_1',
          userMessageText: '',
          turnIndex: 0,
        }),
      )
    })
  })

  it('does not fail conversation start when the GM run fails', async () => {
    const runGameMasterExecuteMock = vi.fn().mockRejectedValue(new Error('gm boom'))
    const useCase = new StartConversationUseCase(
      sessionRepository,
      avatarRepository,
      conversationRepository,
      undefined,
      undefined,
      undefined,
      undefined,
      gmStateRepository,
      { execute: runGameMasterExecuteMock } as unknown as RunGameMasterUseCase,
    )

    await expectConsoleError(
      async () =>
        expect(
          useCase.execute({ sessionId: 'session_1', avatarId: 'avatar_1' }),
        ).resolves.toBeDefined(),
      /Initial GM run failed.*gm boom/,
    )
  })
})

describe('StartConversationUseCase — prior conversation close', () => {
  it('closes the prior active conversation and runs memory pipeline before starting a new one', async () => {
    findActiveBySessionIdMock.mockResolvedValue(
      makeConversation({ conversationId: 'conversation_prev' }),
    )
    const generateForClosedConversation = vi.fn().mockResolvedValue(undefined)
    const memoryMaintenance = { execute: vi.fn().mockResolvedValue(undefined) }
    const useCase = makeUseCaseWithPipeline(generateForClosedConversation, memoryMaintenance)

    await useCase.execute({ sessionId: 'session_1', avatarId: 'avatar_1' })

    expect(updateConversationMock).toHaveBeenCalledWith(
      'conversation_prev',
      expect.objectContaining({ status: 'closed' }),
    )
    expect(memoryMaintenance.execute).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conversation_prev', trigger: 'avatar_switch' }),
    )
    expect(generateForClosedConversation).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conversation_prev' }),
    )
    expect(createConversationMock).toHaveBeenCalledWith(
      expect.objectContaining({ avatarId: 'avatar_1' }),
    )
  })
})

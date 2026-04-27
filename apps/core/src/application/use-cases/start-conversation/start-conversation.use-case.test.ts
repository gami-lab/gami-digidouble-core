import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { Conversation, Session } from '../../../domain/conversation/session.types.js'
import { StartConversationUseCase } from './start-conversation.use-case.js'

const findSessionByIdMock = vi.fn()
const updateSessionMock = vi.fn()
const findAvatarByIdMock = vi.fn()
const createConversationMock = vi.fn()

const sessionRepository = {
  findById: findSessionByIdMock,
  create: vi.fn(),
  update: updateSessionMock,
  delete: vi.fn(),
  countByScenarioId: vi.fn(),
  countActiveByScenarioId: vi.fn(),
}

const avatarRepository = {
  findById: findAvatarByIdMock,
  create: vi.fn(),
  listByScenarioId: vi.fn(),
  delete: vi.fn(),
}

const conversationRepository = {
  findById: vi.fn(),
  findActiveBySessionId: vi.fn(),
  create: createConversationMock,
  listBySessionId: vi.fn(),
  update: vi.fn(),
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
  createConversationMock.mockReset()

  findSessionByIdMock.mockResolvedValue(makeSession())
  updateSessionMock.mockResolvedValue(makeSession())
  findAvatarByIdMock.mockResolvedValue(makeAvatar())
  createConversationMock.mockResolvedValue(makeConversation())
})

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
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { Conversation, Session } from '../../../domain/conversation/session.types.js'
import { SwitchAvatarUseCase } from './switch-avatar.use-case.js'

const findSessionByIdMock = vi.fn()
const updateSessionMock = vi.fn()
const findAvatarByIdMock = vi.fn()
const findActiveBySessionIdMock = vi.fn()
const createConversationMock = vi.fn()
const updateConversationMock = vi.fn()

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
}

const conversationRepository = {
  findById: vi.fn(),
  findActiveBySessionId: findActiveBySessionIdMock,
  create: createConversationMock,
  listBySessionId: vi.fn(),
  deleteBySessionId: vi.fn(),
  update: updateConversationMock,
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

function makeAvatar(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    avatarId: 'avatar_2',
    scenarioId: 'scenario_1',
    name: 'Nova',
    status: 'active',
    personaPrompt: 'You are Nova.',
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

  findSessionByIdMock.mockResolvedValue(makeSession())
  updateSessionMock.mockResolvedValue(makeSession({ activeAvatarId: 'avatar_2' }))
  findAvatarByIdMock.mockResolvedValue(makeAvatar())
  findActiveBySessionIdMock.mockResolvedValue(makeConversation())
  createConversationMock.mockResolvedValue(makeConversation({ avatarId: 'avatar_2' }))
  updateConversationMock.mockResolvedValue(makeConversation({ status: 'closed' }))
})

describe('SwitchAvatarUseCase success flows', () => {
  it('closes active conversation, creates handoff conversation, and updates session', async () => {
    findSessionByIdMock
      .mockResolvedValueOnce(makeSession())
      .mockResolvedValueOnce(makeSession({ activeAvatarId: 'avatar_2' }))

    const useCase = new SwitchAvatarUseCase(
      sessionRepository,
      avatarRepository,
      conversationRepository,
    )

    const output = await useCase.execute({ sessionId: 'session_1', avatarId: 'avatar_2' })

    const closeCall = updateConversationMock.mock.calls[0] as
      | [string, { status?: string; endedAt?: string }]
      | undefined
    expect(closeCall?.[0]).toBe('conversation_1')
    expect(closeCall?.[1].status).toBe('closed')
    expect(typeof closeCall?.[1].endedAt).toBe('string')
    expect(createConversationMock).toHaveBeenCalledWith({
      sessionId: 'session_1',
      avatarId: 'avatar_2',
      startedBy: 'user',
      reason: 'manual_switch',
      handoffFromConversationId: 'conversation_1',
    })
    const sessionUpdateCall = updateSessionMock.mock.calls[0] as
      | [string, { activeAvatarId?: string; lastActivityAt?: string }]
      | undefined
    expect(sessionUpdateCall?.[0]).toBe('session_1')
    expect(sessionUpdateCall?.[1].activeAvatarId).toBe('avatar_2')
    expect(typeof sessionUpdateCall?.[1].lastActivityAt).toBe('string')
    expect(output.previousConversationId).toBe('conversation_1')
    expect(output.session.activeAvatarId).toBe('avatar_2')
    expect(output.conversation.avatarId).toBe('avatar_2')
  })

  it('creates a new conversation without closing when there is no active conversation', async () => {
    findActiveBySessionIdMock.mockResolvedValue(null)

    const useCase = new SwitchAvatarUseCase(
      sessionRepository,
      avatarRepository,
      conversationRepository,
    )

    const output = await useCase.execute({ sessionId: 'session_1', avatarId: 'avatar_2' })

    expect(updateConversationMock).not.toHaveBeenCalled()
    expect(createConversationMock).toHaveBeenCalledWith({
      sessionId: 'session_1',
      avatarId: 'avatar_2',
      startedBy: 'user',
      reason: 'manual_switch',
    })
    expect(output.previousConversationId).toBeNull()
  })

  it('keeps caller reason when provided', async () => {
    const useCase = new SwitchAvatarUseCase(
      sessionRepository,
      avatarRepository,
      conversationRepository,
    )

    await useCase.execute({
      sessionId: 'session_1',
      avatarId: 'avatar_2',
      reason: 'operator_override',
    })

    expect(createConversationMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'operator_override' }),
    )
  })

  it('allows switching to the same avatar by creating a new conversation', async () => {
    findAvatarByIdMock.mockResolvedValue(makeAvatar({ avatarId: 'avatar_1' }))
    createConversationMock.mockResolvedValue(makeConversation({ conversationId: 'conversation_2' }))

    const useCase = new SwitchAvatarUseCase(
      sessionRepository,
      avatarRepository,
      conversationRepository,
    )

    await useCase.execute({ sessionId: 'session_1', avatarId: 'avatar_1' })

    expect(createConversationMock).toHaveBeenCalledWith(
      expect.objectContaining({ avatarId: 'avatar_1' }),
    )
  })

  it('does not enforce reason max length in use case (validated at route layer)', async () => {
    const useCase = new SwitchAvatarUseCase(
      sessionRepository,
      avatarRepository,
      conversationRepository,
    )
    const longReason = 'r'.repeat(201)

    await useCase.execute({
      sessionId: 'session_1',
      avatarId: 'avatar_2',
      reason: longReason,
    })

    expect(createConversationMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: longReason }),
    )
  })
})

describe('SwitchAvatarUseCase validation and state checks', () => {
  it('rejects empty sessionId', async () => {
    const useCase = new SwitchAvatarUseCase(
      sessionRepository,
      avatarRepository,
      conversationRepository,
    )

    await expect(useCase.execute({ sessionId: '   ', avatarId: 'avatar_1' })).rejects.toMatchObject(
      {
        code: 'VALIDATION_ERROR',
      },
    )
  })

  it('rejects non-active sessions', async () => {
    findSessionByIdMock.mockResolvedValue(makeSession({ status: 'closed' }))

    const useCase = new SwitchAvatarUseCase(
      sessionRepository,
      avatarRepository,
      conversationRepository,
    )

    await expect(
      useCase.execute({ sessionId: 'session_1', avatarId: 'avatar_1' }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'Session is not active.',
    })
  })

  it('rejects unknown session or avatar', async () => {
    const useCase = new SwitchAvatarUseCase(
      sessionRepository,
      avatarRepository,
      conversationRepository,
    )

    findSessionByIdMock.mockResolvedValueOnce(null)
    await expect(
      useCase.execute({ sessionId: 'session_missing', avatarId: 'avatar_1' }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })

    findSessionByIdMock.mockResolvedValue(makeSession())
    findAvatarByIdMock.mockResolvedValueOnce(null)
    await expect(
      useCase.execute({ sessionId: 'session_1', avatarId: 'avatar_missing' }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('rejects avatar outside session scenario', async () => {
    findAvatarByIdMock.mockResolvedValue(makeAvatar({ scenarioId: 'scenario_2' }))

    const useCase = new SwitchAvatarUseCase(
      sessionRepository,
      avatarRepository,
      conversationRepository,
    )

    await expect(
      useCase.execute({ sessionId: 'session_1', avatarId: 'avatar_2' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Avatar does not belong to the session scenario.',
    })
  })

  it('rejects switching to a locked avatar when session unlock state is present', async () => {
    findSessionByIdMock.mockResolvedValue(makeSession({ unlockedAvatarIds: ['avatar_1'] }))

    const useCase = new SwitchAvatarUseCase(
      sessionRepository,
      avatarRepository,
      conversationRepository,
    )

    await expect(
      useCase.execute({ sessionId: 'session_1', avatarId: 'avatar_2' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

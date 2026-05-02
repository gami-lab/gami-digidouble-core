import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { Conversation, Message, Session } from '../../../domain/conversation/session.types.js'
import type { User } from '../../../domain/user/user.types.js'
import { expectConsoleError } from '../../../test-utils/console.js'
import type { RunGameMasterUseCase } from '../run-game-master/run-game-master.use-case.js'
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
const appendEventMock = vi.fn()
const traceMock = vi.fn()
const flushMock = vi.fn()
const runGameMasterExecuteMock = vi.fn()
const findUserByIdMock = vi.fn()

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

const llm = { complete: completeMock }
const eventLogRepository = { append: appendEventMock, findBySessionId: vi.fn() }
const observability = { trace: traceMock, flush: flushMock }
const userRepository = { findById: findUserByIdMock, upsert: vi.fn() }

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

function createUseCase(withRunGameMaster = false, withUserRepository = true): SendMessageUseCase {
  const runGameMasterUseCase = withRunGameMaster
    ? ({ execute: runGameMasterExecuteMock } as unknown as RunGameMasterUseCase)
    : null
  return new SendMessageUseCase(
    sessionRepository,
    conversationRepository,
    avatarRepository,
    scenarioRepository,
    messageRepository,
    llm,
    eventLogRepository,
    observability,
    runGameMasterUseCase,
    withUserRepository ? userRepository : undefined,
  )
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
  traceMock.mockReset()
  flushMock.mockReset()
  appendEventMock.mockReset()
  runGameMasterExecuteMock.mockReset()
  findUserByIdMock.mockReset()

  findSessionByIdMock.mockResolvedValue(makeSession())
  updateSessionMock.mockResolvedValue(makeSession())
  findConversationByIdMock.mockResolvedValue(makeConversation())
  updateConversationMock.mockResolvedValue(makeConversation())
  findAvatarByIdMock.mockResolvedValue(makeAvatar())
  findScenarioByIdMock.mockResolvedValue({
    scenarioId: 'scenario_1',
    name: 'Scenario',
    status: 'active',
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
  traceMock.mockResolvedValue(undefined)
  flushMock.mockResolvedValue(undefined)
  appendEventMock.mockResolvedValue(undefined)
  runGameMasterExecuteMock.mockResolvedValue(undefined)
  findUserByIdMock.mockResolvedValue(null)
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

    expect(findMessagesByConversationIdMock).toHaveBeenCalledWith('conversation_1', { limit: 20 })
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

describe('SendMessageUseCase — observability payload', () => {
  it('traces system prompt and user prompt messages for llm completions', async () => {
    const useCase = createUseCase()

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello tracing' })
    await new Promise((resolve) => setTimeout(resolve, 0))

    const traceArg = traceMock.mock.calls[0]?.[0] as {
      input?: {
        systemPrompt?: string
        messages?: Array<{ role: string; content: string }>
      }
      metadata?: Record<string, unknown>
    }
    expect(traceArg.input?.systemPrompt).toContain('You are Ava.')
    expect(traceArg.input?.messages).toEqual([{ role: 'user', content: 'Hello tracing' }])
    expect(traceArg.metadata?.['model']).toBe('null-model')
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
      config: {
        avatarAvailability: {
          initialAvatarIds: ['avatar_1'],
          unlockableAvatarIds: ['avatar_2'],
        },
      },
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

describe('SendMessageUseCase — validation and GM integration', () => {
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
    expect(llmRequest.systemPrompt).toContain('Director notes: Push user deeper into examples.')
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
    expect(runGameMasterExecuteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session_1',
        scenarioId: 'scenario_1',
        avatarId: 'avatar_1',
        userMessageText: 'Hello',
      }),
    )
  })
})

describe('SendMessageUseCase — user persona injection', () => {
  it('injects persona role sentence when user repository returns persona', async () => {
    const useCase = createUseCase(false, true)
    findUserByIdMock.mockResolvedValue({
      userId: 'user_1',
      persona: { role: 'psychologist' },
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:00:00.000Z',
    } satisfies User)

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })

    const llmRequest = completeMock.mock.calls[0]?.[0] as { systemPrompt: string }
    expect(llmRequest.systemPrompt).toContain(
      'You are speaking with someone in the role of: psychologist.',
    )
  })

  it('succeeds when user repository is not injected', async () => {
    const useCase = createUseCase(false, false)

    await expect(
      useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' }),
    ).resolves.toBeDefined()
  })

  it('succeeds when user repository lookup throws and omits persona sentence', async () => {
    const useCase = createUseCase(false, true)
    findUserByIdMock.mockRejectedValueOnce(new Error('user lookup unavailable'))

    await expect(
      useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' }),
    ).resolves.toBeDefined()

    const llmRequest = completeMock.mock.calls[0]?.[0] as { systemPrompt: string }
    expect(llmRequest.systemPrompt).not.toContain('You are speaking with someone in the role of:')
  })

  it('omits persona sentence when user exists without persona', async () => {
    const useCase = createUseCase(false, true)
    findUserByIdMock.mockResolvedValue({
      userId: 'user_1',
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:00:00.000Z',
    } satisfies User)

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })

    const llmRequest = completeMock.mock.calls[0]?.[0] as { systemPrompt: string }
    expect(llmRequest.systemPrompt).not.toContain('You are speaking with someone in the role of:')
  })

  it('passes userPersona to run game master when persona is present', async () => {
    const useCase = createUseCase(true, true)
    findUserByIdMock.mockResolvedValue({
      userId: 'user_1',
      persona: { role: 'coach' },
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:00:00.000Z',
    } satisfies User)

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })

    expect(runGameMasterExecuteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userPersona: { role: 'coach' },
      }),
    )
  })

  it('calls run game master without userPersona when persona is absent', async () => {
    const useCase = createUseCase(true, true)
    findUserByIdMock.mockResolvedValue({
      userId: 'user_1',
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:00:00.000Z',
    } satisfies User)

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })

    const gmInput = runGameMasterExecuteMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(Object.hasOwn(gmInput, 'userPersona')).toBe(false)
  })
})

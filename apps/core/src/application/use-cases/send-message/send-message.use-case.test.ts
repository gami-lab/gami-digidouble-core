/* eslint-disable max-lines */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConversationEndReason } from '@gami/shared'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { Conversation, Message, Session } from '../../../domain/conversation/session.types.js'
import { expectConsoleError } from '../../../test-utils/console.js'
import type { IMemoryMaintenancePort } from '../../ports/IMemoryMaintenancePort.js'
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
const runGameMasterExecuteMock = vi.fn()
const endConversationExecuteMock = vi.fn()
const findUserByIdMock = vi.fn()
const findUserFactsByUserIdMock = vi.fn()
const memoryMaintenanceExecuteMock = vi.fn()

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
const userRepository = { findById: findUserByIdMock, upsert: vi.fn() }
const userMemoryFactRepository = {
  findByUserId: findUserFactsByUserIdMock,
  upsert: vi.fn(),
  findById: vi.fn(),
  deleteById: vi.fn(),
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
): SendMessageUseCase {
  const runGameMasterUseCase = toRunGameMasterUseCase(withRunGameMaster)
  const endConversationUseCase = toConversationCloser(withImplicitEnd)
  const memoryMaintenance = toMemoryMaintenance(withMemoryMaintenance)
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
  appendEventMock.mockReset()
  runGameMasterExecuteMock.mockReset()
  endConversationExecuteMock.mockReset()
  findUserByIdMock.mockReset()
  findUserFactsByUserIdMock.mockReset()
  memoryMaintenanceExecuteMock.mockReset()

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
        recentExchanges: [],
        scenario: { scenarioId: 'scenario_1' },
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

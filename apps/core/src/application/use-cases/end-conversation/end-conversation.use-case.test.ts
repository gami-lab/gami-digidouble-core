import { describe, expect, it, vi } from 'vitest'
import { EndConversationUseCase } from './end-conversation.use-case.js'
import { InMemoryConversationRepository } from '../../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryEventLogRepository } from '../../../infrastructure/db/in-memory-event-log.repository.js'
import { InMemoryMessageRepository } from '../../../infrastructure/db/in-memory-message.repository.js'
import { InMemorySessionRepository } from '../../../infrastructure/db/in-memory-session.repository.js'
import { InMemoryUserMemoryFactRepository } from '../../../infrastructure/db/in-memory-user-memory-fact.repository.js'
import { DomainError } from '../../../domain/errors.js'
import type { IMemoryMaintenancePort } from '../../ports/IMemoryMaintenancePort.js'
import type { IMessageRepository } from '../../ports/IMessageRepository.js'
import type { IUserFactExtractor } from '../../ports/IUserFactExtractor.js'
import type { IUserMemoryFactRepository } from '../../ports/IUserMemoryFactRepository.js'
import { expectConsoleError } from '../../../test-utils/console.js'

function makeRepositories() {
  const sessionRepository = new InMemorySessionRepository([
    {
      sessionId: 'session_1',
      userId: 'user_1',
      scenarioId: 'scenario_1',
      status: 'active',
      startedAt: '2026-05-01T10:00:00.000Z',
      lastActivityAt: '2026-05-01T10:01:00.000Z',
    },
  ])
  const conversationRepository = new InMemoryConversationRepository([
    {
      conversationId: 'conversation_1',
      sessionId: 'session_1',
      avatarId: 'avatar_1',
      status: 'active',
      startedAt: '2026-05-01T10:00:10.000Z',
      lastActivityAt: '2026-05-01T10:01:00.000Z',
    },
  ])
  const eventLogRepository = new InMemoryEventLogRepository()
  const messageRepository = new InMemoryMessageRepository([
    {
      messageId: 'message_1',
      conversationId: 'conversation_1',
      role: 'user',
      content: 'I prefer English and I am a product manager.',
      createdAt: '2026-05-01T10:00:20.000Z',
    },
    {
      messageId: 'message_2',
      conversationId: 'conversation_1',
      role: 'avatar',
      content: 'Noted, I can keep responses concise.',
      createdAt: '2026-05-01T10:00:30.000Z',
    },
  ])
  return { sessionRepository, conversationRepository, eventLogRepository, messageRepository }
}

function createUseCase(options?: {
  memoryMaintenance?: IMemoryMaintenancePort
  messageRepository?: IMessageRepository
  userFactExtractor?: IUserFactExtractor
  userMemoryFactRepository?: IUserMemoryFactRepository
  episodicMemoryService?: {
    generateForClosedConversation(input: {
      conversationId: string
      sessionId: string
      userId: string
      avatarId: string
      scenarioId: string
    }): Promise<unknown>
  }
}) {
  const { sessionRepository, conversationRepository, eventLogRepository, messageRepository } =
    makeRepositories()

  return {
    sessionRepository,
    conversationRepository,
    eventLogRepository,
    messageRepository,
    useCase: new EndConversationUseCase(
      sessionRepository,
      conversationRepository,
      eventLogRepository,
      options?.memoryMaintenance,
      undefined,
      options?.messageRepository ?? messageRepository,
      options?.userFactExtractor,
      options?.userMemoryFactRepository,
      options?.episodicMemoryService,
    ),
  }
}

async function expectEventTypes(
  eventLogRepository: InMemoryEventLogRepository,
  expectedTypes: string[],
): Promise<void> {
  await vi.waitFor(() => {
    const events = eventLogRepository.getAll().map((event) => event.type)
    for (const type of expectedTypes) {
      expect(events).toContain(type)
    }
  })
}

describe('EndConversationUseCase', () => {
  it('closes an active conversation and schedules memory refresh', async () => {
    const memoryMaintenance = {
      execute: vi.fn().mockResolvedValue(undefined),
    } satisfies IMemoryMaintenancePort
    const { sessionRepository, conversationRepository, useCase } = createUseCase({
      memoryMaintenance,
    })

    const output = await useCase.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      reason: 'user_end',
    })

    expect(output.compaction.scheduled).toBe(true)
    expect(output.conversation.status).toBe('closed')
    expect(memoryMaintenance.execute).toHaveBeenCalledWith({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      trigger: 'conversation_closed',
    })

    const persistedConversation = await conversationRepository.findById('conversation_1')
    expect(persistedConversation?.status).toBe('closed')
    expect(persistedConversation?.reason).toBe('user_end')

    const persistedSession = await sessionRepository.findById('session_1')
    expect(persistedSession?.lastActivityAt).toBe(output.conversation.lastActivityAt)
  })

  it('defaults reason to operator_end when omitted', async () => {
    const { conversationRepository, useCase } = createUseCase()

    await useCase.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
    })

    const persistedConversation = await conversationRepository.findById('conversation_1')
    expect(persistedConversation?.reason).toBe('operator_end')
  })

  it('throws CONFLICT when conversation is already closed', async () => {
    const sessionRepository = new InMemorySessionRepository([
      {
        sessionId: 'session_1',
        userId: 'user_1',
        scenarioId: 'scenario_1',
        status: 'active',
        startedAt: '2026-05-01T10:00:00.000Z',
        lastActivityAt: '2026-05-01T10:01:00.000Z',
      },
    ])
    const conversationRepository = new InMemoryConversationRepository([
      {
        conversationId: 'conversation_1',
        sessionId: 'session_1',
        avatarId: 'avatar_1',
        status: 'closed',
        startedAt: '2026-05-01T10:00:10.000Z',
        lastActivityAt: '2026-05-01T10:01:00.000Z',
        endedAt: '2026-05-01T10:01:00.000Z',
      },
    ])
    const useCase = new EndConversationUseCase(
      sessionRepository,
      conversationRepository,
      new InMemoryEventLogRepository(),
    )

    await expect(
      useCase.execute({ sessionId: 'session_1', conversationId: 'conversation_1' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' } satisfies Partial<DomainError>)
  })

  it('keeps close successful when memory refresh fails', async () => {
    const memoryMaintenance = {
      execute: vi.fn().mockRejectedValue(new Error('refresh down')),
    } satisfies IMemoryMaintenancePort
    const { useCase } = createUseCase({ memoryMaintenance })

    await expectConsoleError(
      async () =>
        await useCase.execute({
          sessionId: 'session_1',
          conversationId: 'conversation_1',
          reason: 'operator_end',
        }),
      /\[end-conversation\] Background memory refresh failed:/,
    )
  })
})

describe('EndConversationUseCase episodic generation', () => {
  it('generates one episodic memory per closed conversation', async () => {
    const generateForClosedConversation = vi.fn().mockResolvedValue(undefined)
    const { eventLogRepository, useCase } = createUseCase({
      episodicMemoryService: { generateForClosedConversation },
    })

    await useCase.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      reason: 'operator_end',
    })

    await vi.waitFor(() => {
      expect(generateForClosedConversation).toHaveBeenCalledTimes(1)
    })
    await expectEventTypes(eventLogRepository, [
      'episodic_memory_generation_triggered',
      'episodic_memory_generation_succeeded',
    ])
  })
})

describe('EndConversationUseCase user fact extraction wiring', () => {
  it('skips extraction when userFactExtractor is not injected', async () => {
    const userMemoryFactRepository = new InMemoryUserMemoryFactRepository()
    const { useCase } = createUseCase({ userMemoryFactRepository })

    await expect(
      useCase.execute({ sessionId: 'session_1', conversationId: 'conversation_1' }),
    ).resolves.toBeDefined()
    await expect(userMemoryFactRepository.findByUserId('user_1')).resolves.toEqual([])
  })

  it('skips extraction when userMemoryFactRepository is not injected', async () => {
    const extractor: IUserFactExtractor = {
      extract: vi
        .fn()
        .mockResolvedValue([
          { category: 'preference', key: 'language', value: 'english', confidence: 0.8 },
        ]),
    }
    const { useCase } = createUseCase({ userFactExtractor: extractor })

    await expect(
      useCase.execute({ sessionId: 'session_1', conversationId: 'conversation_1' }),
    ).resolves.toBeDefined()
  })

  it('upserts extracted facts when both dependencies are injected', async () => {
    const extractor: IUserFactExtractor = {
      extract: vi.fn().mockResolvedValue([
        { category: 'preference', key: 'language', value: 'english', confidence: 0.9 },
        { category: 'identity', key: 'role', value: 'product manager', confidence: 0.8 },
      ]),
    }
    const userMemoryFactRepository = new InMemoryUserMemoryFactRepository()
    const upsertSpy = vi.spyOn(userMemoryFactRepository, 'upsert')
    const { eventLogRepository, useCase } = createUseCase({
      userFactExtractor: extractor,
      userMemoryFactRepository,
    })

    await useCase.execute({ sessionId: 'session_1', conversationId: 'conversation_1' })
    await vi.waitFor(() => {
      expect(upsertSpy).toHaveBeenCalledTimes(2)
    })
    await expectEventTypes(eventLogRepository, [
      'user_fact_extraction_triggered',
      'user_fact_extraction_succeeded',
    ])
  })
})

describe('EndConversationUseCase user fact extraction failure handling', () => {
  it('does not throw when extractor fails', async () => {
    const extractor: IUserFactExtractor = {
      extract: vi.fn().mockRejectedValue(new Error('llm failed')),
    }
    const { eventLogRepository, useCase } = createUseCase({
      userFactExtractor: extractor,
      userMemoryFactRepository: new InMemoryUserMemoryFactRepository(),
    })

    await expect(
      useCase.execute({ sessionId: 'session_1', conversationId: 'conversation_1' }),
    ).resolves.toBeDefined()
    await expectEventTypes(eventLogRepository, ['user_fact_extraction_failed'])
  })

  it('does not throw when upsert fails', async () => {
    const extractor: IUserFactExtractor = {
      extract: vi
        .fn()
        .mockResolvedValue([{ category: 'preference', key: 'language', value: 'english' }]),
    }
    const failingRepository: IUserMemoryFactRepository = {
      findByUserId: vi.fn(),
      findById: vi.fn(),
      deleteById: vi.fn(),
      upsert: vi.fn().mockRejectedValue(new Error('db write failed')),
    }
    const { eventLogRepository, useCase } = createUseCase({
      userFactExtractor: extractor,
      userMemoryFactRepository: failingRepository,
    })

    await expect(
      useCase.execute({ sessionId: 'session_1', conversationId: 'conversation_1' }),
    ).resolves.toBeDefined()
    await expectEventTypes(eventLogRepository, ['user_fact_extraction_failed'])
  })
})

describe('EndConversationUseCase runtime event emission', () => {
  it('emits runtime.session_closed event when publisher is provided', async () => {
    const emittedEvents: { type: string; sessionId: string; conversationId?: string }[] = []
    const publisher = {
      emit: vi.fn((event: { type: string; sessionId: string; conversationId?: string }) => {
        emittedEvents.push(event)
      }),
      subscribe: vi.fn(),
      getLastEvent: vi.fn(),
      isProcessing: vi.fn(),
      setProcessing: vi.fn(),
    }
    const { sessionRepository, conversationRepository } = makeRepositories()
    const useCase = new EndConversationUseCase(
      sessionRepository,
      conversationRepository,
      new InMemoryEventLogRepository(),
      undefined,
      publisher,
    )

    await useCase.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      reason: 'user_end',
    })

    const closedEvent = emittedEvents.find((event) => event.type === 'runtime.session_closed')
    expect(closedEvent).toBeDefined()
    expect(closedEvent?.sessionId).toBe('session_1')
    expect(closedEvent?.conversationId).toBe('conversation_1')
  })

  it('does not throw when no publisher is provided', async () => {
    const { useCase } = createUseCase()

    await expect(
      useCase.execute({ sessionId: 'session_1', conversationId: 'conversation_1' }),
    ).resolves.toBeDefined()
  })
})

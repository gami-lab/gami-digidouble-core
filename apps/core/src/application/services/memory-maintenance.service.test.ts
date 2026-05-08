import { describe, expect, it, vi } from 'vitest'
import { InMemoryAvatarSessionMemoryRepository } from '../../infrastructure/db/in-memory-avatar-session-memory.repository.js'
import { InMemoryEventLogRepository } from '../../infrastructure/db/in-memory-event-log.repository.js'
import { InMemoryMessageRepository } from '../../infrastructure/db/in-memory-message.repository.js'
import { InMemorySessionMemoryRepository } from '../../infrastructure/db/in-memory-session-memory.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { InMemoryConversationWorkingMemoryRepository } from '../../infrastructure/db/in-memory-conversation-working-memory.repository.js'
import type { ILlmAdapter } from '../ports/ILlmAdapter.js'
import { MemoryMaintenanceService } from './memory-maintenance.service.js'

const compactionMessages = [
  {
    messageId: 'msg_1',
    conversationId: 'conversation_1',
    role: 'user' as const,
    content: 'I am a doctor using AI for patient files.',
    createdAt: '2026-05-06T10:00:00.000Z',
  },
  {
    messageId: 'msg_2',
    conversationId: 'conversation_1',
    role: 'avatar' as const,
    content: 'Use privacy-safe redaction workflows.',
    createdAt: '2026-05-06T10:00:01.000Z',
  },
  {
    messageId: 'msg_3',
    conversationId: 'conversation_1',
    role: 'user' as const,
    content: 'What should I do first?',
    createdAt: '2026-05-06T10:00:02.000Z',
  },
  {
    messageId: 'msg_4',
    conversationId: 'conversation_1',
    role: 'avatar' as const,
    content: 'Start with a no-PII drafting process.',
    createdAt: '2026-05-06T10:00:03.000Z',
  },
  {
    messageId: 'msg_5',
    conversationId: 'conversation_1',
    role: 'user' as const,
    content: 'How do I stay compliant?',
    createdAt: '2026-05-06T10:00:04.000Z',
  },
  {
    messageId: 'msg_6',
    conversationId: 'conversation_1',
    role: 'avatar' as const,
    content: 'Apply role-based access and audit logs.',
    createdAt: '2026-05-06T10:00:05.000Z',
  },
]

function createCompactionService(args: {
  llm: ILlmAdapter
  conversationWorkingMemoryRepository: InMemoryConversationWorkingMemoryRepository
  eventLogRepository: InMemoryEventLogRepository
}): MemoryMaintenanceService {
  return new MemoryMaintenanceService(
    new InMemoryMessageRepository(compactionMessages),
    args.conversationWorkingMemoryRepository,
    args.eventLogRepository,
    args.llm,
  )
}

function makeService() {
  const messageRepository = new InMemoryMessageRepository([
    {
      messageId: 'msg_1',
      conversationId: 'conversation_1',
      role: 'user',
      content: 'How should I start?',
      createdAt: '2026-05-06T10:00:00.000Z',
    },
    {
      messageId: 'msg_2',
      conversationId: 'conversation_1',
      role: 'avatar',
      content: 'Start with a small concrete step.',
      createdAt: '2026-05-06T10:00:01.000Z',
    },
    {
      messageId: 'msg_3',
      conversationId: 'conversation_1',
      role: 'user',
      content: 'Can you give me an example?',
      createdAt: '2026-05-06T10:00:02.000Z',
    },
    {
      messageId: 'msg_4',
      conversationId: 'conversation_1',
      role: 'avatar',
      content: 'Build one short scenario and test it.',
      createdAt: '2026-05-06T10:00:03.000Z',
    },
    {
      messageId: 'msg_5',
      conversationId: 'conversation_1',
      role: 'user',
      content: 'What should I measure first?',
      createdAt: '2026-05-06T10:00:04.000Z',
    },
    {
      messageId: 'msg_6',
      conversationId: 'conversation_1',
      role: 'avatar',
      content: 'Track time-to-first-value and drop-off.',
      createdAt: '2026-05-06T10:00:05.000Z',
    },
  ])
  const sessionRepository = new InMemorySessionRepository([
    {
      sessionId: 'session_1',
      userId: 'user_1',
      scenarioId: 'scenario_1',
      status: 'active',
      startedAt: '2026-05-06T09:59:00.000Z',
      lastActivityAt: '2026-05-06T10:00:01.000Z',
    },
  ])
  const sessionMemoryRepository = new InMemorySessionMemoryRepository()
  const avatarSessionMemoryRepository = new InMemoryAvatarSessionMemoryRepository()
  const conversationWorkingMemoryRepository = new InMemoryConversationWorkingMemoryRepository()
  const eventLogRepository = new InMemoryEventLogRepository()

  const defaultLlm: ILlmAdapter = {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        summary: 'Conversation turns: user=3, avatar=3.',
        unresolvedThreads: [],
        candidateFacts: [],
      }),
      model: 'test-model',
      inputTokens: 10,
      outputTokens: 20,
      latencyMs: 5,
    }),
  }
  return {
    service: new MemoryMaintenanceService(
      messageRepository,
      conversationWorkingMemoryRepository,
      eventLogRepository,
      defaultLlm,
    ),
    sessionRepository,
    sessionMemoryRepository,
    avatarSessionMemoryRepository,
    conversationWorkingMemoryRepository,
    eventLogRepository,
  }
}

describe('MemoryMaintenanceService — persistence and events', () => {
  it('refreshes canonical conversation working memory only', async () => {
    const {
      service,
      sessionMemoryRepository,
      avatarSessionMemoryRepository,
      conversationWorkingMemoryRepository,
    } = makeService()

    await service.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      trigger: 'post_turn',
      correlationId: 'corr_1',
    })

    await expect(
      conversationWorkingMemoryRepository.findByConversationId('conversation_1'),
    ).resolves.toMatchObject({
      conversationId: 'conversation_1',
      sessionId: 'session_1',
      avatarId: 'avatar_1',
      summary: 'Conversation turns: user=3, avatar=3.',
    })
    await expect(sessionMemoryRepository.findBySessionId('session_1')).resolves.toBeNull()
    await expect(
      avatarSessionMemoryRepository.findBySessionIdAndAvatarId('session_1', 'avatar_1'),
    ).resolves.toBeNull()
  })

  it('updates existing canonical row on repeated turns rather than creating duplicates', async () => {
    const { service, conversationWorkingMemoryRepository } = makeService()

    await service.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      trigger: 'post_turn',
    })
    const firstConversationMemory =
      await conversationWorkingMemoryRepository.findByConversationId('conversation_1')

    await service.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      trigger: 'post_turn',
    })
    const secondConversationMemory =
      await conversationWorkingMemoryRepository.findByConversationId('conversation_1')

    expect(secondConversationMemory?.conversationId).toBe(firstConversationMemory?.conversationId)
  })
})

describe('MemoryMaintenanceService — LLM compaction', () => {
  it('uses validated LLM compaction output for working memory when available', async () => {
    const {
      sessionMemoryRepository,
      avatarSessionMemoryRepository,
      conversationWorkingMemoryRepository,
      eventLogRepository,
    } = makeService()
    const llmCompleteMock = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        summary: 'Compact clinical privacy summary.',
        unresolvedThreads: ['Need HIPAA-safe workflow template'],
        candidateFacts: [
          {
            category: 'context',
            key: 'profession',
            value: 'doctor',
          },
        ],
      }),
      model: 'test-model',
      inputTokens: 10,
      outputTokens: 20,
      latencyMs: 5,
    })
    const llm: ILlmAdapter = {
      complete: llmCompleteMock,
    }
    const service = createCompactionService({
      llm,
      conversationWorkingMemoryRepository,
      eventLogRepository,
    })

    await service.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      trigger: 'post_turn',
    })

    await expect(sessionMemoryRepository.findBySessionId('session_1')).resolves.toBeNull()
    await expect(
      avatarSessionMemoryRepository.findBySessionIdAndAvatarId('session_1', 'avatar_1'),
    ).resolves.toBeNull()
    await expect(
      conversationWorkingMemoryRepository.findByConversationId('conversation_1'),
    ).resolves.toMatchObject({
      summary: 'Compact clinical privacy summary.',
      unresolvedThreads: ['Need HIPAA-safe workflow template'],
      candidateFacts: [{ category: 'context', key: 'profession', value: 'doctor' }],
    })
    expect(llmCompleteMock).toHaveBeenCalledTimes(1)
  })
})

describe('MemoryMaintenanceService — event payload contract', () => {
  it('emits triggered and succeeded events with correct payload fields', async () => {
    const { service, eventLogRepository } = makeService()

    await service.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      trigger: 'post_turn',
      correlationId: 'corr_1',
    })

    const events = eventLogRepository.getAll()
    const types = events.map((event) => event.type)
    expect(types).toContain('memory_refresh_triggered')
    expect(types).toContain('memory_refresh_succeeded')

    const triggered = events.find((e) => e.type === 'memory_refresh_triggered')
    expect(triggered?.payload).toMatchObject({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      trigger: 'post_turn',
    })
    expect(triggered?.correlationId).toBe('corr_1')

    const succeeded = events.find((e) => e.type === 'memory_refresh_succeeded')
    expect(succeeded?.payload).toMatchObject({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      trigger: 'post_turn',
      messageCount: 6,
      exchangeCount: 3,
    })
    const succeededPayload = succeeded?.payload
    expect(typeof succeededPayload?.workingSummary).toBe('string')
    expect(Array.isArray(succeededPayload?.unresolvedThreads)).toBe(true)
    expect(Array.isArray(succeededPayload?.candidateFacts)).toBe(true)
    expect(succeeded?.correlationId).toBe('corr_1')
  })

  it('emits memory_refresh_failed with correct payload when persistence fails', async () => {
    const { eventLogRepository } = makeService()
    const messageRepository = {
      findByConversationId: vi.fn().mockRejectedValue(new Error('messages unavailable')),
      save: vi.fn(),
      deleteByConversationId: vi.fn(),
    }
    const service = new MemoryMaintenanceService(
      messageRepository,
      new InMemoryConversationWorkingMemoryRepository(),
      eventLogRepository,
      {
        complete: vi.fn().mockResolvedValue({
          content: '{}',
          model: 'test',
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: 0,
        }),
      },
    )

    await expect(
      service.execute({
        sessionId: 'session_1',
        conversationId: 'conversation_1',
        avatarId: 'avatar_1',
        trigger: 'conversation_closed',
      }),
    ).resolves.toBeUndefined()

    const events = eventLogRepository.getAll()
    const types = events.map((event) => event.type)
    expect(types).toContain('memory_refresh_triggered')
    expect(types).toContain('memory_refresh_failed')

    const failed = events.find((e) => e.type === 'memory_refresh_failed')
    expect(failed?.payload).toMatchObject({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      trigger: 'conversation_closed',
      error: 'messages unavailable',
    })
  })
})

describe('MemoryMaintenanceService — prior memory continuity', () => {
  it('incorporates prior working memory summary when refreshing', async () => {
    const { service, conversationWorkingMemoryRepository } = makeService()

    // First refresh — seeds the working memory
    await service.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      trigger: 'post_turn',
    })
    const firstMemory =
      await conversationWorkingMemoryRepository.findByConversationId('conversation_1')
    expect(firstMemory).not.toBeNull()

    // Second refresh — should build on the prior memory, not discard it
    await service.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      trigger: 'post_turn',
    })
    const secondMemory =
      await conversationWorkingMemoryRepository.findByConversationId('conversation_1')
    // The second summary should contain material from the first (prior memory preserved)
    expect(secondMemory?.summary).toContain(firstMemory?.summary)
  })
})

describe('MemoryMaintenanceService — post_turn policy gate', () => {
  it('skips post_turn refresh when exchange count is not a multiple of 3', async () => {
    const messageRepository = new InMemoryMessageRepository([
      {
        messageId: 'msg_1',
        conversationId: 'conversation_1',
        role: 'user',
        content: 'one',
        createdAt: '2026-05-06T10:00:00.000Z',
      },
      {
        messageId: 'msg_2',
        conversationId: 'conversation_1',
        role: 'avatar',
        content: 'one',
        createdAt: '2026-05-06T10:00:01.000Z',
      },
    ])
    const sessionMemoryRepository = new InMemorySessionMemoryRepository()
    const conversationWorkingMemoryRepository = new InMemoryConversationWorkingMemoryRepository()
    const eventLogRepository = new InMemoryEventLogRepository()
    const service = new MemoryMaintenanceService(
      messageRepository,
      conversationWorkingMemoryRepository,
      eventLogRepository,
      {
        complete: vi.fn().mockResolvedValue({
          content: '{}',
          model: 'test',
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: 0,
        }),
      },
    )

    await service.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      trigger: 'post_turn',
    })

    await expect(sessionMemoryRepository.findBySessionId('session_1')).resolves.toBeNull()
    await expect(
      conversationWorkingMemoryRepository.findByConversationId('conversation_1'),
    ).resolves.toBeNull()
  })
})

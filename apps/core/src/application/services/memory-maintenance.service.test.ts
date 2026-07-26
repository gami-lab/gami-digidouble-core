/* eslint-disable max-lines */
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
        coveredTopics: [],
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
      scenarioId: 'scenario_1',
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
      coveredTopics: [],
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
      scenarioId: 'scenario_1',
      trigger: 'post_turn',
    })
    const firstConversationMemory =
      await conversationWorkingMemoryRepository.findByConversationId('conversation_1')

    await service.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      trigger: 'post_turn',
    })
    const secondConversationMemory =
      await conversationWorkingMemoryRepository.findByConversationId('conversation_1')

    expect(secondConversationMemory?.conversationId).toBe(firstConversationMemory?.conversationId)
  })
})

// eslint-disable-next-line max-lines-per-function
describe('MemoryMaintenanceService — LLM compaction', () => {
  it('sends a deterministic compaction prompt and input contract to the LLM', async () => {
    const conversationWorkingMemoryRepository = new InMemoryConversationWorkingMemoryRepository([
      {
        conversationId: 'conversation_1',
        sessionId: 'session_1',
        avatarId: 'avatar_1',
        summary: 'Prior summary',
        unresolvedThreads: ['Need workflow template'],
        coveredTopics: ['privacy_workflows'],
        candidateFacts: [{ category: 'context', key: 'profession', value: 'doctor' }],
        updatedAt: '2026-05-06T09:59:00.000Z',
      },
    ])
    const eventLogRepository = new InMemoryEventLogRepository()
    const llmCompleteMock = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        summary: 'Updated summary',
        coveredTopics: ['privacy_workflows', 'hipaa_compliance'],
        unresolvedThreads: ['Need workflow template'],
        candidateFacts: [{ category: 'context', key: 'profession', value: 'doctor' }],
      }),
      model: 'test-model',
      inputTokens: 10,
      outputTokens: 20,
      latencyMs: 5,
    })
    const service = createCompactionService({
      llm: { complete: llmCompleteMock },
      conversationWorkingMemoryRepository,
      eventLogRepository,
    })

    await service.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      trigger: 'post_turn',
    })

    const llmRequest = llmCompleteMock.mock.calls[0]?.[0] as {
      systemPrompt: string
      messages: Array<{ role: 'user'; content: string }>
    }
    expect(llmRequest.systemPrompt).toContain(
      'Return JSON only with exactly these top-level keys: summary, coveredTopics, unresolvedThreads, candidateFacts.',
    )
    expect(llmRequest.systemPrompt).toContain(
      'remove items that were clearly answered or resolved in the recent exchanges',
    )
    expect(llmRequest.systemPrompt).toContain(
      'reject inferred trust, mood, pacing, progression state, emotional state, or other conversational interpretation',
    )
    expect(llmRequest.messages[0]?.content).toContain('## PRIOR WORKING MEMORY')
    expect(llmRequest.messages[0]?.content).toContain('Covered topics:')
    expect(llmRequest.messages[0]?.content).toContain('- privacy_workflows')
    expect(llmRequest.messages[0]?.content).toContain('## RECENT EXCHANGES TO INTEGRATE')
    expect(llmRequest.messages[0]?.content).toContain(
      '1. USER: I am a doctor using AI for patient files.',
    )
    expect(llmRequest.messages[0]?.content).toContain(
      '6. AVATAR: Apply role-based access and audit logs.',
    )
  })

  it('keeps contradicted Avatar claims out of candidate facts and preserves the unresolved thread', async () => {
    const messages = [
      ['user', 'Where is Mona now?'],
      ['avatar', 'Mona stayed with her grandfather.'],
      ['user', 'Your answer is contradictory.'],
      ['avatar', 'You are right; Mona was not at the chalet.'],
      ['user', 'Can you clarify her confirmed location?'],
      ['avatar', 'My memories are confused.'],
    ].map(([role, content], index) => ({
      messageId: `mona_${String(index)}`,
      conversationId: 'conversation_1',
      role: role as 'user' | 'avatar',
      content: content ?? '',
      createdAt: `2026-05-06T10:00:0${String(index)}.000Z`,
    }))
    const llmCompleteMock = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        summary: 'Mona location remains unresolved.',
        coveredTopics: ['Mona absence from the chalet'],
        unresolvedThreads: ['Clarify Mona current confirmed location.'],
        candidateFacts: [
          { category: 'context', key: 'mona_current_location', value: 'with grandfather' },
        ],
      }),
      model: 'test-model',
      inputTokens: 10,
      outputTokens: 20,
      latencyMs: 5,
    })
    const workingMemory = new InMemoryConversationWorkingMemoryRepository()
    const service = new MemoryMaintenanceService(
      new InMemoryMessageRepository(messages),
      workingMemory,
      new InMemoryEventLogRepository(),
      { complete: llmCompleteMock },
    )

    await service.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      trigger: 'post_turn',
    })

    await expect(workingMemory.findByConversationId('conversation_1')).resolves.toMatchObject({
      unresolvedThreads: ['Clarify Mona current confirmed location.'],
      candidateFacts: [],
    })
  })

  it('labels verified context and allows it to resolve an otherwise unsupported claim', async () => {
    const workingMemory = new InMemoryConversationWorkingMemoryRepository()
    const llmCompleteMock = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        summary: 'Verified context establishes Mona stayed with her grandfather.',
        coveredTopics: ['Mona location'],
        unresolvedThreads: [],
        candidateFacts: [
          { category: 'context', key: 'mona_current_location', value: 'with grandfather' },
        ],
      }),
      model: 'test-model',
      inputTokens: 10,
      outputTokens: 20,
      latencyMs: 5,
    })
    const service = new MemoryMaintenanceService(
      new InMemoryMessageRepository(compactionMessages),
      workingMemory,
      new InMemoryEventLogRepository(),
      { complete: llmCompleteMock },
    )

    await service.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      trigger: 'post_turn',
      verifiedContext: [
        {
          source: 'canonical',
          content: 'Mona initially stayed with her grandfather.',
        },
      ],
    })

    const request = llmCompleteMock.mock.calls[0]?.[0] as {
      systemPrompt: string
      messages: Array<{ content: string }>
    }
    expect(request.systemPrompt).toContain('Treat Avatar statements as conversational claims')
    expect(request.messages[0]?.content).toContain('## VERIFIED CONTEXT')
    expect(request.messages[0]?.content).toContain(
      '- [canonical] Mona initially stayed with her grandfather.',
    )
    await expect(workingMemory.findByConversationId('conversation_1')).resolves.toMatchObject({
      candidateFacts: [
        { category: 'context', key: 'mona_current_location', value: 'with grandfather' },
      ],
    })
  })

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
        coveredTopics: ['privacy_safe_redaction', 'hipaa_compliance'],
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
      scenarioId: 'scenario_1',
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
      coveredTopics: ['privacy_safe_redaction', 'hipaa_compliance'],
      candidateFacts: [{ category: 'context', key: 'profession', value: 'doctor' }],
    })
    expect(llmCompleteMock).toHaveBeenCalledTimes(1)
  })

  it('normalizes bounded output and rejects malformed inferred fact data', async () => {
    const { conversationWorkingMemoryRepository, eventLogRepository } = makeService()
    const llmCompleteMock = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        summary: `  ${'S'.repeat(710)}  `,
        coveredTopics: ['  privacy workflows  ', '', 'privacy workflows', 'x'.repeat(100), 42],
        unresolvedThreads: ['  Need benchmark  ', '', 'Need benchmark', 'Y'.repeat(200)],
        candidateFacts: [
          { category: 'context', key: 'profession', value: '  doctor  ' },
          { category: 'context', key: 'profession', value: 'doctor' },
          { category: 'goal', key: 'conversation_pacing', value: 'fast' },
          { category: 'context', key: 'memory_condition', value: 'my memories are confused' },
          { category: 'unknown', key: 'bad', value: 'ignored' },
          { category: 'goal', key: 'bad key', value: 'ignored' },
          { category: 'goal', key: 'launch_target', value: 'Z'.repeat(200) },
        ],
      }),
      model: 'test-model',
      inputTokens: 10,
      outputTokens: 20,
      latencyMs: 5,
    })
    const service = createCompactionService({
      llm: { complete: llmCompleteMock },
      conversationWorkingMemoryRepository,
      eventLogRepository,
    })

    await service.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      trigger: 'post_turn',
    })

    await expect(
      conversationWorkingMemoryRepository.findByConversationId('conversation_1'),
    ).resolves.toMatchObject({
      summary: `${'S'.repeat(697)}...`,
      coveredTopics: ['privacy workflows', `${'x'.repeat(77)}...`],
      unresolvedThreads: ['Need benchmark', `${'Y'.repeat(157)}...`],
      candidateFacts: [
        { category: 'context', key: 'profession', value: 'doctor' },
        { category: 'goal', key: 'launch_target', value: `${'Z'.repeat(157)}...` },
      ],
    })
  })
})

describe('MemoryMaintenanceService — event payload contract', () => {
  it('emits triggered and succeeded events with correct payload fields', async () => {
    const { service, eventLogRepository } = makeService()

    await service.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
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
      scenarioId: 'scenario_1',
      trigger: 'post_turn',
    })
    expect(triggered?.correlationId).toBe('corr_1')

    const succeeded = events.find((e) => e.type === 'memory_refresh_succeeded')
    expect(succeeded?.payload).toMatchObject({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      trigger: 'post_turn',
      messageCount: 6,
      exchangeCount: 3,
    })
    const succeededPayload = succeeded?.payload
    expect(typeof succeededPayload?.workingSummary).toBe('string')
    expect(Array.isArray(succeededPayload?.unresolvedThreads)).toBe(true)
    expect(Array.isArray(succeededPayload?.coveredTopics)).toBe(true)
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
        scenarioId: 'scenario_1',
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
      scenarioId: 'scenario_1',
      trigger: 'conversation_closed',
      error: 'messages unavailable',
    })
  })
})

// eslint-disable-next-line max-lines-per-function
describe('MemoryMaintenanceService — prior memory continuity', () => {
  it('incorporates prior working memory summary when refreshing', async () => {
    const { service, conversationWorkingMemoryRepository } = makeService()

    // First refresh — seeds the working memory
    await service.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
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
      scenarioId: 'scenario_1',
      trigger: 'post_turn',
    })
    const secondMemory =
      await conversationWorkingMemoryRepository.findByConversationId('conversation_1')
    // The second summary should contain material from the first (prior memory preserved)
    expect(secondMemory?.summary).toContain(firstMemory?.summary)
  })

  it('lets resolved unresolved threads disappear while active ones carry forward cleanly', async () => {
    const conversationWorkingMemoryRepository = new InMemoryConversationWorkingMemoryRepository([
      {
        conversationId: 'conversation_1',
        sessionId: 'session_1',
        avatarId: 'avatar_1',
        summary: 'Prior working memory',
        unresolvedThreads: ['Need budget signoff', 'Need benchmark'],
        coveredTopics: ['requirements_reviewed'],
        candidateFacts: [],
        updatedAt: '2026-05-06T09:59:00.000Z',
      },
    ])
    const service = new MemoryMaintenanceService(
      new InMemoryMessageRepository(compactionMessages),
      conversationWorkingMemoryRepository,
      new InMemoryEventLogRepository(),
      {
        complete: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            summary: 'Updated memory',
            coveredTopics: ['requirements_reviewed', 'privacy_workflows'],
            unresolvedThreads: ['Need benchmark', 'Need rollout checklist'],
            candidateFacts: [],
          }),
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
      scenarioId: 'scenario_1',
      trigger: 'post_turn',
    })

    await expect(
      conversationWorkingMemoryRepository.findByConversationId('conversation_1'),
    ).resolves.toMatchObject({
      unresolvedThreads: ['Need benchmark', 'Need rollout checklist'],
    })
  })

  it('preserves prior covered topics when compaction output does not provide them yet', async () => {
    const conversationWorkingMemoryRepository = new InMemoryConversationWorkingMemoryRepository([
      {
        conversationId: 'conversation_1',
        sessionId: 'session_1',
        avatarId: 'avatar_1',
        summary: 'Prior working memory',
        unresolvedThreads: ['Need follow-up'],
        coveredTopics: ['intro_complete', 'requirements_reviewed'],
        candidateFacts: [],
        updatedAt: '2026-05-06T09:59:00.000Z',
      },
    ])
    const eventLogRepository = new InMemoryEventLogRepository()
    const service = new MemoryMaintenanceService(
      new InMemoryMessageRepository(compactionMessages),
      conversationWorkingMemoryRepository,
      eventLogRepository,
      {
        complete: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            summary: 'Updated summary without covered topics field.',
            unresolvedThreads: ['Need follow-up'],
            candidateFacts: [],
          }),
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
      scenarioId: 'scenario_1',
      trigger: 'post_turn',
    })

    await expect(
      conversationWorkingMemoryRepository.findByConversationId('conversation_1'),
    ).resolves.toMatchObject({
      coveredTopics: ['intro_complete', 'requirements_reviewed'],
    })
    expect(
      eventLogRepository.getAll().find((event) => event.type === 'memory_refresh_succeeded')
        ?.payload,
    ).toMatchObject({
      coveredTopics: ['intro_complete', 'requirements_reviewed'],
    })
  })
})

describe('MemoryMaintenanceService — pending refresh coordination', () => {
  it('awaits the in-flight refresh for the same conversation', async () => {
    let releaseRefresh: (() => void) | undefined
    let signalLlmStarted: (() => void) | undefined
    const llmStarted = new Promise<void>((resolve) => {
      signalLlmStarted = resolve
    })
    const llmComplete = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          signalLlmStarted?.()
          releaseRefresh = () => {
            resolve({
              content: JSON.stringify({
                summary: 'Updated working memory.',
                unresolvedThreads: [],
                candidateFacts: [],
              }),
              model: 'test',
              inputTokens: 0,
              outputTokens: 0,
              latencyMs: 0,
            })
          }
        }),
    )
    const service = new MemoryMaintenanceService(
      new InMemoryMessageRepository(compactionMessages),
      new InMemoryConversationWorkingMemoryRepository(),
      new InMemoryEventLogRepository(),
      { complete: llmComplete },
    )

    const refreshPromise = service.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      trigger: 'post_turn',
    })

    let awaited = false
    const waitPromise = service.awaitPendingRefresh('conversation_1').then(() => {
      awaited = true
    })

    await llmStarted
    expect(awaited).toBe(false)

    releaseRefresh?.()

    await refreshPromise
    await waitPromise
    expect(awaited).toBe(true)
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
      scenarioId: 'scenario_1',
      trigger: 'post_turn',
    })

    await expect(sessionMemoryRepository.findBySessionId('session_1')).resolves.toBeNull()
    await expect(
      conversationWorkingMemoryRepository.findByConversationId('conversation_1'),
    ).resolves.toBeNull()
  })

  it('refreshes post_turn memory again at 6 exchanges when conversation exceeds 10 messages', async () => {
    const messageRepository = new InMemoryMessageRepository(
      Array.from({ length: 12 }, (_, index) => ({
        messageId: `msg_${String(index + 1)}`,
        conversationId: 'conversation_1',
        role: index % 2 === 0 ? 'user' : ('avatar' as const),
        content: `message_${String(index + 1)}`,
        createdAt: `2026-05-06T10:00:${index.toString().padStart(2, '0')}.000Z`,
      })),
    )
    const conversationWorkingMemoryRepository = new InMemoryConversationWorkingMemoryRepository()
    const eventLogRepository = new InMemoryEventLogRepository()
    const llmComplete = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        summary: 'Updated after 6 exchanges.',
        unresolvedThreads: [],
        candidateFacts: [],
      }),
      model: 'test',
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 0,
    })
    const service = new MemoryMaintenanceService(
      messageRepository,
      conversationWorkingMemoryRepository,
      eventLogRepository,
      { complete: llmComplete },
    )

    await service.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      trigger: 'post_turn',
    })

    await expect(
      conversationWorkingMemoryRepository.findByConversationId('conversation_1'),
    ).resolves.toMatchObject({
      summary: 'Updated after 6 exchanges.',
    })
    const succeededEvent = eventLogRepository
      .getAll()
      .find((event) => event.type === 'memory_refresh_succeeded')
    expect(succeededEvent?.payload).toMatchObject({
      exchangeCount: 6,
      messageCount: 10,
    })
    expect(llmComplete).toHaveBeenCalledTimes(1)
  })
})

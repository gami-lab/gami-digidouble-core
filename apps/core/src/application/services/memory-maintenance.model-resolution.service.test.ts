import { describe, expect, it, vi } from 'vitest'
import type { ModelConfig } from '../../domain/model-config/index.js'
import { InMemoryConversationWorkingMemoryRepository } from '../../infrastructure/db/in-memory-conversation-working-memory.repository.js'
import { InMemoryEventLogRepository } from '../../infrastructure/db/in-memory-event-log.repository.js'
import { InMemoryMessageRepository } from '../../infrastructure/db/in-memory-message.repository.js'
import { MemoryMaintenanceService } from './memory-maintenance.service.js'

describe('MemoryMaintenanceService model resolution', () => {
  it('uses memory role and fallback config when repository returns null', async () => {
    const resolvedAdapterCompleteMock = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        summary: 'Resolved memory summary.',
        unresolvedThreads: [],
        candidateFacts: [],
      }),
      model: 'memory-model',
      inputTokens: 10,
      outputTokens: 20,
      latencyMs: 5,
    })
    const modelConfigRepository = { get: vi.fn().mockResolvedValue(null), upsert: vi.fn() }
    const llmAdapterRegistry = {
      get: vi.fn().mockReturnValue({ complete: resolvedAdapterCompleteMock }),
    }
    const modelConfigFallback: ModelConfig = {
      globalDefault: { provider: 'xai', model: '' },
      roleOverrides: { memory: { provider: 'anthropic', model: 'claude-memory' } },
      updatedAt: '2026-05-20T00:00:00.000Z',
    }
    const service = new MemoryMaintenanceService(
      new InMemoryMessageRepository([
        {
          messageId: 'msg_1',
          conversationId: 'conversation_1',
          role: 'user',
          content: 'first',
          createdAt: '2026-05-06T10:00:00.000Z',
        },
        {
          messageId: 'msg_2',
          conversationId: 'conversation_1',
          role: 'avatar',
          content: 'second',
          createdAt: '2026-05-06T10:00:01.000Z',
        },
        {
          messageId: 'msg_3',
          conversationId: 'conversation_1',
          role: 'user',
          content: 'third',
          createdAt: '2026-05-06T10:00:02.000Z',
        },
        {
          messageId: 'msg_4',
          conversationId: 'conversation_1',
          role: 'avatar',
          content: 'fourth',
          createdAt: '2026-05-06T10:00:03.000Z',
        },
        {
          messageId: 'msg_5',
          conversationId: 'conversation_1',
          role: 'user',
          content: 'fifth',
          createdAt: '2026-05-06T10:00:04.000Z',
        },
        {
          messageId: 'msg_6',
          conversationId: 'conversation_1',
          role: 'avatar',
          content: 'sixth',
          createdAt: '2026-05-06T10:00:05.000Z',
        },
      ]),
      new InMemoryConversationWorkingMemoryRepository(),
      new InMemoryEventLogRepository(),
      { complete: vi.fn() },
      modelConfigRepository,
      llmAdapterRegistry,
      modelConfigFallback,
    )

    await service.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      trigger: 'post_turn',
    })

    expect(modelConfigRepository.get).toHaveBeenCalledTimes(1)
    expect(llmAdapterRegistry.get).toHaveBeenCalledWith('anthropic')
    const llmRequest = resolvedAdapterCompleteMock.mock.calls[0]?.[0] as {
      model?: string
      trace: { metadata: { effectiveProvider: string; effectiveModel: string } }
    }
    expect(llmRequest.model).toBe('claude-memory')
    expect(llmRequest.trace.metadata.effectiveProvider).toBe('anthropic')
    expect(llmRequest.trace.metadata.effectiveModel).toBe('claude-memory')
  })
})

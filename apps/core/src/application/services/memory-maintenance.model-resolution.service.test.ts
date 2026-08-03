import { describe, expect, it, vi } from 'vitest'
import type { ModelConfig } from '../../domain/model-config/index.js'
import { InMemoryConversationWorkingMemoryRepository } from '../../infrastructure/db/in-memory-conversation-working-memory.repository.js'
import { InMemoryEventLogRepository } from '../../infrastructure/db/in-memory-event-log.repository.js'
import { InMemoryMessageRepository } from '../../infrastructure/db/in-memory-message.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { MemoryMaintenanceService } from './memory-maintenance.service.js'

function makeFixtureMessages(): InstanceType<typeof InMemoryMessageRepository> {
  const roles: Array<'user' | 'avatar'> = ['user', 'avatar', 'user', 'avatar', 'user', 'avatar']
  const contents = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth']
  return new InMemoryMessageRepository(
    roles.map((role, index) => ({
      messageId: `msg_${String(index + 1)}`,
      conversationId: 'conversation_1',
      role,
      content: contents[index] ?? '',
      createdAt: `2026-05-06T10:00:0${String(index)}.000Z`,
    })),
  )
}

function makeCompactionResponse(model: string) {
  return vi.fn().mockResolvedValue({
    content: JSON.stringify({
      summary: 'Resolved memory summary.',
      coveredTopics: [],
      unresolvedThreads: [],
      candidateFacts: [],
    }),
    model,
    inputTokens: 10,
    outputTokens: 20,
    latencyMs: 5,
  })
}

// eslint-disable-next-line max-lines-per-function
describe('MemoryMaintenanceService model resolution', () => {
  it('uses the session model override before scenario and role configuration', async () => {
    const resolvedAdapterCompleteMock = makeCompactionResponse('gpt-5.6-luna')
    const modelConfigRepository = { get: vi.fn().mockResolvedValue(null), upsert: vi.fn() }
    const llmAdapterRegistry = {
      get: vi.fn().mockReturnValue({ complete: resolvedAdapterCompleteMock }),
    }
    const sessionRepository = new InMemorySessionRepository([
      {
        sessionId: 'session_1',
        userId: 'user_1',
        scenarioId: 'scenario_1',
        modelOverride: { provider: 'openai', model: 'gpt-5.6-luna' },
        status: 'active',
        startedAt: '2026-05-06T10:00:00.000Z',
        lastActivityAt: '2026-05-06T10:00:00.000Z',
      },
    ])
    const scenarioRepository = {
      findById: vi.fn().mockResolvedValue({
        scenarioId: 'scenario_1',
        modelSelection: { memoryOverride: { provider: 'xai', model: 'grok-4.3' } },
      }),
      create: vi.fn(),
      list: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    }
    const service = new MemoryMaintenanceService(
      makeFixtureMessages(),
      new InMemoryConversationWorkingMemoryRepository(),
      new InMemoryEventLogRepository(),
      { complete: vi.fn() },
      modelConfigRepository,
      llmAdapterRegistry,
      {
        globalDefault: { provider: 'xai', model: 'grok-4.3' },
        roleOverrides: {},
        updatedAt: '2026-05-20T00:00:00.000Z',
      },
      scenarioRepository,
      sessionRepository,
    )

    await service.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      trigger: 'post_turn',
    })

    expect(llmAdapterRegistry.get).toHaveBeenCalledWith('openai')
    const llmRequest = resolvedAdapterCompleteMock.mock.calls[0]?.[0] as {
      model?: string
      trace: { metadata: { effectiveProvider: string; effectiveModel: string } }
    }
    expect(llmRequest.model).toBe('gpt-5.6-luna')
    expect(llmRequest.trace.metadata.effectiveProvider).toBe('openai')
    expect(llmRequest.trace.metadata.effectiveModel).toBe('gpt-5.6-luna')
  })

  it('uses memory role and fallback config when repository returns null', async () => {
    const resolvedAdapterCompleteMock = makeCompactionResponse('memory-model')
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
      makeFixtureMessages(),
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
      scenarioId: 'scenario_1',
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

  it('prefers the scenario memoryOverride over the global/role config', async () => {
    const resolvedAdapterCompleteMock = makeCompactionResponse('grok-4.3')
    const modelConfigRepository = { get: vi.fn().mockResolvedValue(null), upsert: vi.fn() }
    const llmAdapterRegistry = {
      get: vi.fn().mockReturnValue({ complete: resolvedAdapterCompleteMock }),
    }
    const modelConfigFallback: ModelConfig = {
      globalDefault: { provider: 'openai', model: 'gpt-4o-mini' },
      roleOverrides: {},
      updatedAt: '2026-05-20T00:00:00.000Z',
    }
    const scenarioRepository = {
      findById: vi.fn().mockResolvedValue({
        scenarioId: 'scenario_1',
        modelSelection: { memoryOverride: { provider: 'xai', model: 'grok-4.3' } },
      }),
      create: vi.fn(),
      list: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    }
    const service = new MemoryMaintenanceService(
      makeFixtureMessages(),
      new InMemoryConversationWorkingMemoryRepository(),
      new InMemoryEventLogRepository(),
      { complete: vi.fn() },
      modelConfigRepository,
      llmAdapterRegistry,
      modelConfigFallback,
      scenarioRepository,
    )

    await service.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      trigger: 'post_turn',
    })

    expect(scenarioRepository.findById).toHaveBeenCalledWith('scenario_1')
    expect(llmAdapterRegistry.get).toHaveBeenCalledWith('xai')
    const llmRequest = resolvedAdapterCompleteMock.mock.calls[0]?.[0] as {
      model?: string
      trace: { metadata: { effectiveProvider: string; effectiveModel: string } }
    }
    expect(llmRequest.model).toBe('grok-4.3')
    expect(llmRequest.trace.metadata.effectiveProvider).toBe('xai')
  })
})

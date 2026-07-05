/* eslint-disable max-lines-per-function */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ModelConfig } from '../../../domain/model-config/index.js'
import type { Message } from '../../../domain/conversation/session.types.js'
import { SendMessageUseCase } from './send-message.use-case.js'

const findSessionByIdMock = vi.fn()
const updateSessionMock = vi.fn()
const findConversationByIdMock = vi.fn()
const updateConversationMock = vi.fn()
const findAvatarByIdMock = vi.fn()
const findScenarioByIdMock = vi.fn()
const findMessagesByConversationIdMock = vi.fn()
const saveMessageMock = vi.fn()
const appendEventMock = vi.fn()

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
  listByScenarioId: vi.fn().mockResolvedValue([]),
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
const llm = { complete: vi.fn() }
const eventLogRepository = { append: appendEventMock, findBySessionId: vi.fn() }

beforeEach(() => {
  findSessionByIdMock.mockResolvedValue({
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    activeAvatarId: 'avatar_1',
    status: 'active',
    startedAt: '2026-04-18T10:00:00.000Z',
    lastActivityAt: '2026-04-18T10:00:00.000Z',
  })
  findConversationByIdMock.mockResolvedValue({
    conversationId: 'conversation_1',
    sessionId: 'session_1',
    avatarId: 'avatar_1',
    status: 'active',
    startedAt: '2026-04-18T10:00:00.000Z',
    lastActivityAt: '2026-04-18T10:00:00.000Z',
  })
  findAvatarByIdMock.mockResolvedValue({
    avatarId: 'avatar_1',
    scenarioId: 'scenario_1',
    name: 'Ava',
    status: 'active',
    personaPrompt: 'You are Ava.',
    config: {},
    createdAt: '2026-04-20T10:00:00.000Z',
    updatedAt: '2026-04-20T10:00:00.000Z',
  })
  findScenarioByIdMock.mockResolvedValue({
    scenarioId: 'scenario_1',
    name: 'Scenario',
    status: 'active',
    objectives: [],
    worldContext: '',
    avatarAvailability: { initialAvatarIds: [] },
    config: {},
    createdAt: '2026-04-18T10:00:00.000Z',
    updatedAt: '2026-04-18T10:00:00.000Z',
  })
  findMessagesByConversationIdMock.mockResolvedValue([])
  saveMessageMock.mockImplementation((message: Message) => Promise.resolve(message))
  appendEventMock.mockResolvedValue(undefined)
  updateSessionMock.mockResolvedValue({
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    activeAvatarId: 'avatar_1',
    status: 'active',
    startedAt: '2026-04-18T10:00:00.000Z',
    lastActivityAt: '2026-04-18T10:00:01.000Z',
  })
  updateConversationMock.mockResolvedValue({
    conversationId: 'conversation_1',
    sessionId: 'session_1',
    avatarId: 'avatar_1',
    status: 'active',
    startedAt: '2026-04-18T10:00:00.000Z',
    lastActivityAt: '2026-04-18T10:00:01.000Z',
  })
})

describe('SendMessageUseCase model resolution', () => {
  it('uses avatar override provider and role/global model fallback with metadata', async () => {
    const completeMock = vi.fn().mockResolvedValue({
      content: 'Avatar reply',
      model: 'resolved-model',
      inputTokens: 10,
      outputTokens: 20,
      latencyMs: 5,
    })
    const modelConfigRepository = {
      get: vi.fn().mockResolvedValue({
        globalDefault: { provider: 'null', model: '' },
        roleOverrides: { avatar: { provider: 'openai', model: 'gpt-4o' } },
        updatedAt: '2026-05-20T00:00:00.000Z',
      } satisfies ModelConfig),
      upsert: vi.fn(),
    }
    const llmAdapterRegistry = { get: vi.fn().mockReturnValue({ complete: completeMock }) }
    findAvatarByIdMock.mockResolvedValue({
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      name: 'Ava',
      status: 'active',
      personaPrompt: 'You are Ava.',
      config: {},
      createdAt: '2026-04-20T10:00:00.000Z',
      updatedAt: '2026-04-20T10:00:00.000Z',
      llmOverride: { provider: 'anthropic' },
    })
    const useCase = new SendMessageUseCase(
      sessionRepository,
      conversationRepository,
      avatarRepository,
      scenarioRepository,
      messageRepository,
      llm,
      eventLogRepository,
      null,
      undefined,
      null,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      modelConfigRepository,
      llmAdapterRegistry,
    )

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })

    expect(llmAdapterRegistry.get).toHaveBeenCalledWith('anthropic')
    const llmRequest = completeMock.mock.calls[0]?.[0] as {
      model?: string
      trace: { metadata: { effectiveProvider: string; effectiveModel: string } }
    }
    expect(llmRequest.model).toBe('gpt-4o')
    expect(llmRequest.trace.metadata.effectiveProvider).toBe('anthropic')
    expect(llmRequest.trace.metadata.effectiveModel).toBe('gpt-4o')
  })

  it('uses fallback config when repository returns null', async () => {
    const completeMock = vi.fn().mockResolvedValue({
      content: 'Avatar reply',
      model: 'default-model',
      inputTokens: 10,
      outputTokens: 20,
      latencyMs: 5,
    })
    const modelConfigRepository = { get: vi.fn().mockResolvedValue(null), upsert: vi.fn() }
    const llmAdapterRegistry = { get: vi.fn().mockReturnValue({ complete: completeMock }) }
    const modelConfigFallback: ModelConfig = {
      globalDefault: { provider: 'openai', model: '' },
      roleOverrides: {},
      updatedAt: '2026-05-20T00:00:00.000Z',
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
      undefined,
      null,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      modelConfigRepository,
      llmAdapterRegistry,
      modelConfigFallback,
    )

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })

    expect(llmAdapterRegistry.get).toHaveBeenCalledWith('openai')
    const llmRequest = completeMock.mock.calls[0]?.[0] as {
      model?: string
      trace: { metadata: { effectiveModel: string } }
    }
    expect(llmRequest.model).toBeUndefined()
    expect(llmRequest.trace.metadata.effectiveModel).toBe('adapter_default')
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ModelConfig } from '../../../domain/model-config/index.js'
import { RunGameMasterUseCase } from './run-game-master.use-case.js'

const findBySessionIdMock = vi.fn()
const saveGmStateMock = vi.fn()
const findSessionByIdMock = vi.fn()
const listAvatarsByScenarioIdMock = vi.fn()
const findScenarioByIdMock = vi.fn()
const findMessagesByConversationIdMock = vi.fn()

beforeEach(() => {
  findBySessionIdMock.mockResolvedValue({
    progression: '',
    topicsCovered: [],
    interactionCount: 0,
  })
  saveGmStateMock.mockResolvedValue(undefined)
  findSessionByIdMock.mockResolvedValue({
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    activeAvatarId: 'avatar_1',
    status: 'active',
    startedAt: '2026-04-18T10:00:00.000Z',
    lastActivityAt: '2026-04-18T10:00:00.000Z',
  })
  listAvatarsByScenarioIdMock.mockResolvedValue([
    {
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
      name: 'Ava',
      status: 'active',
      personaPrompt: 'You are Ava.',
      config: {},
      createdAt: '2026-04-20T10:00:00.000Z',
      updatedAt: '2026-04-20T10:00:00.000Z',
    },
  ])
  findScenarioByIdMock.mockResolvedValue({
    scenarioId: 'scenario_1',
    name: 'Scenario',
    status: 'active',
    objectives: [],
    worldContext: '',
    avatarAvailability: { initialAvatarIds: [] },
    modelSelection: {
      defaultProfile: { provider: 'openai', model: 'gpt-4o-mini' },
      gameMasterOverride: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    },
    config: {
      goals: ['Goal'],
      modelSelection: {
        defaultProfile: { provider: 'openai', model: 'gpt-4o-mini' },
        gameMasterOverride: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
      },
    },
    createdAt: '2026-04-18T10:00:00.000Z',
    updatedAt: '2026-04-18T10:00:00.000Z',
  })
  findMessagesByConversationIdMock.mockResolvedValue([])
})

describe('RunGameMasterUseCase model resolution', () => {
  it('uses scenario Game Master override before global role config', async () => {
    const completeMock = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        avatarId: 'avatar_1',
        conversationMode: 'continue',
        context: { notes: 'Role resolution.' },
        stateUpdate: { progression: 'increase', interactionIncrement: 1 },
      }),
      model: 'gm-role-model',
      inputTokens: 10,
      outputTokens: 20,
      latencyMs: 4,
    })
    const modelConfigRepository = {
      get: vi.fn().mockResolvedValue({
        globalDefault: { provider: 'openai', model: 'global-model' },
        roleOverrides: {
          gameMaster: { provider: 'mistral', model: 'gm-role-model' },
          avatar: { provider: 'anthropic', model: 'avatar-role-model' },
        },
        updatedAt: '2026-05-20T00:00:00.000Z',
      } satisfies ModelConfig),
      upsert: vi.fn(),
    }
    const llmAdapterRegistry = { get: vi.fn().mockReturnValue({ complete: completeMock }) }

    const useCase = new RunGameMasterUseCase(
      { findBySessionId: findBySessionIdMock, save: saveGmStateMock },
      {
        findById: findSessionByIdMock,
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        countByScenarioId: vi.fn(),
        countActiveByScenarioId: vi.fn(),
      },
      {
        findById: vi.fn(),
        create: vi.fn(),
        listByScenarioId: listAvatarsByScenarioIdMock,
        delete: vi.fn(),
        update: vi.fn(),
        saveComputedTraits: vi.fn(),
      },
      { complete: vi.fn() },
      { trace: vi.fn(), flush: vi.fn() },
      {
        findById: findScenarioByIdMock,
        create: vi.fn(),
        list: vi.fn(),
        delete: vi.fn(),
        update: vi.fn(),
      },
      undefined,
      undefined,
      {
        save: vi.fn(),
        findByConversationId: findMessagesByConversationIdMock,
        deleteByConversationId: vi.fn(),
      },
      undefined,
      undefined,
      undefined,
      modelConfigRepository,
      llmAdapterRegistry,
    )

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 2,
      correlationId: 'request_1',
    })

    expect(llmAdapterRegistry.get).toHaveBeenCalledWith('anthropic')
    const llmRequest = completeMock.mock.calls[0]?.[0] as {
      model?: string
      trace: { metadata: { effectiveProvider: string; effectiveModel: string } }
    }
    expect(llmRequest.model).toBe('claude-sonnet-4-6')
    expect(llmRequest.trace.metadata.effectiveProvider).toBe('anthropic')
    expect(llmRequest.trace.metadata.effectiveModel).toBe('claude-sonnet-4-6')
  })
})

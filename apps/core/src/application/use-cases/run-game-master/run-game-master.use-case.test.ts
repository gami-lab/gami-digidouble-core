import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { GameMasterState } from '../../../domain/game-master/game-master.types.js'
import { expectConsoleError } from '../../../test-utils/console.js'
import { LlmError } from '../../../infrastructure/llm/llm.error.js'
import { InMemoryEventLogRepository } from '../../../infrastructure/db/in-memory-event-log.repository.js'
import { RunGameMasterUseCase } from './run-game-master.use-case.js'

const findBySessionIdMock = vi.fn()
const saveGmStateMock = vi.fn()
const findSessionByIdMock = vi.fn()
const updateSessionMock = vi.fn()
const listAvatarsByScenarioIdMock = vi.fn()
const completeMock = vi.fn()
const traceMock = vi.fn()
const findScenarioByIdMock = vi.fn()

const gmStateRepository = { findBySessionId: findBySessionIdMock, save: saveGmStateMock }
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
  findById: vi.fn(),
  create: vi.fn(),
  listByScenarioId: listAvatarsByScenarioIdMock,
  delete: vi.fn(),
  update: vi.fn(),
}
const scenarioRepository = {
  findById: findScenarioByIdMock,
  create: vi.fn(),
  list: vi.fn(),
  delete: vi.fn(),
  update: vi.fn(),
}
const llm = { complete: completeMock }
const observability = { trace: traceMock, flush: vi.fn() }

function makeState(overrides: Partial<GameMasterState> = {}): GameMasterState {
  return {
    progression: 'progressing',
    topicsCovered: ['plastic'],
    interactionCount: 1,
    currentAvatarId: 'avatar_1',
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

function createUseCase(eventLog?: InMemoryEventLogRepository): RunGameMasterUseCase {
  return new RunGameMasterUseCase(
    gmStateRepository,
    sessionRepository,
    avatarRepository,
    llm,
    observability,
    scenarioRepository,
    eventLog,
  )
}

beforeEach(() => {
  findBySessionIdMock.mockReset()
  saveGmStateMock.mockReset()
  findSessionByIdMock.mockReset()
  updateSessionMock.mockReset()
  listAvatarsByScenarioIdMock.mockReset()
  completeMock.mockReset()
  traceMock.mockReset()
  findScenarioByIdMock.mockReset()

  findBySessionIdMock.mockResolvedValue(makeState())
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
  updateSessionMock.mockResolvedValue(undefined)
  listAvatarsByScenarioIdMock.mockResolvedValue([makeAvatar()])
  findScenarioByIdMock.mockResolvedValue({
    scenarioId: 'scenario_1',
    name: 'Scenario',
    status: 'active',
    config: {
      worldContext: 'A learning world.',
      objectives: ['Understand the basics.'],
      goals: ['Ask better questions.'],
    },
    createdAt: '2026-04-18T10:00:00.000Z',
    updatedAt: '2026-04-18T10:00:00.000Z',
  })
  completeMock.mockResolvedValue({
    content: JSON.stringify({
      avatarId: 'avatar_1',
      conversationMode: 'continue',
      context: { notes: 'Help the user move to concrete examples.' },
      stateUpdate: {
        progression: 'increase',
        topicCovered: 'ocean_cleanup',
        interactionIncrement: 1,
      },
    }),
    model: 'null-model',
    inputTokens: 10,
    outputTokens: 20,
    latencyMs: 4,
  })
  traceMock.mockResolvedValue(undefined)
})

describe('RunGameMasterUseCase', () => {
  it('calls the GM LLM after every turn and persists reduced state', async () => {
    const useCase = createUseCase()

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 2,
      correlationId: 'request_1',
    })

    expect(completeMock).toHaveBeenCalledTimes(1)
    expect(saveGmStateMock).toHaveBeenCalledWith(
      'session_1',
      expect.objectContaining({
        interactionCount: 2,
        topicsCovered: ['plastic', 'ocean_cleanup'],
      }),
    )
    expect(updateSessionMock).toHaveBeenCalledWith('session_1', {
      gmNotes: 'Help the user move to concrete examples.',
    })
  })

  it('passes scenario goals and avatar availability into GM input', async () => {
    const useCase = createUseCase()

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 2,
      correlationId: 'request_2',
    })

    const request = completeMock.mock.calls[0]?.[0] as { messages: Array<{ content: string }> }
    const gmInput = JSON.parse(request.messages[0]?.content ?? '{}') as {
      context: { experience: { goals: string[] }; availableAvatars: unknown[] }
    }
    expect(gmInput.context.experience.goals).toEqual([
      'Understand the basics.',
      'Ask better questions.',
    ])
    expect(gmInput.context.availableAvatars).toEqual([{ avatarId: 'avatar_1', name: 'Ava' }])
  })

  it('passes userPersona through to GM input when provided', async () => {
    const useCase = createUseCase()

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 2,
      correlationId: 'request_persona',
      userPersona: { role: 'friend' },
    })

    const request = completeMock.mock.calls[0]?.[0] as { messages: Array<{ content: string }> }
    const gmInput = JSON.parse(request.messages[0]?.content ?? '{}') as {
      context: { userPersona?: { role?: string } }
    }
    expect(gmInput.context.userPersona?.role).toBe('friend')
  })

  it('does not inject empty userPersona when input has none', async () => {
    const useCase = createUseCase()

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 2,
      correlationId: 'request_no_persona',
    })

    const request = completeMock.mock.calls[0]?.[0] as { messages: Array<{ content: string }> }
    const gmInput = JSON.parse(request.messages[0]?.content ?? '{}') as {
      context: Record<string, unknown>
    }
    expect(Object.hasOwn(gmInput.context, 'userPersona')).toBe(false)
  })
})

describe('RunGameMasterUseCase — event log', () => {
  it('emits gm_triggered with post-turn reason and safe decision fields', async () => {
    const eventLog = new InMemoryEventLogRepository()
    const useCase = createUseCase(eventLog)

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'secret user input',
      turnIndex: 2,
      correlationId: 'corr_xyz',
    })

    const event = eventLog.getAll()[0]
    expect(event?.type).toBe('gm_triggered')
    expect(event?.payload['triggerReason']).toBe('post_turn_observation')
    expect(event?.payload['decision']).toBeDefined()
    expect(JSON.stringify(event?.payload ?? {})).not.toContain('secret user input')
    expect(JSON.stringify(event?.payload ?? {})).not.toContain('systemPrompt')
  })

  it('enriches gm_triggered payload with latency, token usage, and correlation id', async () => {
    const eventLog = new InMemoryEventLogRepository()
    const useCase = createUseCase(eventLog)

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 2,
      correlationId: 'corr_metric',
    })

    const event = eventLog.getAll()[0]
    expect(typeof event?.payload['latencyMs']).toBe('number')
    expect(event?.payload['inputTokens']).toBe(10)
    expect(event?.payload['outputTokens']).toBe(20)
    expect(event?.payload['correlationId']).toBe('corr_metric')
  })
})

describe('RunGameMasterUseCase — error handling', () => {
  it('does not propagate LlmError, increments state, and emits gm_error', async () => {
    const eventLog = new InMemoryEventLogRepository()
    const useCase = createUseCase(eventLog)
    completeMock.mockRejectedValue(new LlmError('null', 'provider down', 503))

    await expectConsoleError(
      () =>
        useCase.execute({
          sessionId: 'session_1',
          scenarioId: 'scenario_1',
          avatarId: 'avatar_1',
          userMessageText: 'hello',
          turnIndex: 2,
          correlationId: 'corr_err',
        }),
      /\[GM\] LLM call failed:/,
    )

    expect(saveGmStateMock).toHaveBeenCalledWith(
      'session_1',
      expect.objectContaining({ interactionCount: 2 }),
    )
    expect(eventLog.getAll()[0]?.type).toBe('gm_error')
    expect(eventLog.getAll()[0]?.payload['errorCode']).toBe('llm_error')
  })
})

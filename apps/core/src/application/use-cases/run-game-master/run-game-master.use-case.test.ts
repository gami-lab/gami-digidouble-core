import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { GameMasterState } from '../../../domain/game-master/game-master.types.js'
import { expectConsoleError } from '../../../test-utils/console.js'
import { LlmError } from '../../../infrastructure/llm/llm.error.js'
import { InMemoryEventLogRepository } from '../../../infrastructure/db/in-memory-event-log.repository.js'
import { RunGameMasterUseCase } from './run-game-master.use-case.js'

const findBySessionIdMock = vi.fn()
const saveGmStateMock = vi.fn()
const updateSessionMock = vi.fn()
const listAvatarsByScenarioIdMock = vi.fn()
const completeMock = vi.fn()
const traceMock = vi.fn()
const flushMock = vi.fn()

const gmStateRepository = {
  findBySessionId: findBySessionIdMock,
  save: saveGmStateMock,
}

const sessionRepository = {
  findById: vi.fn(),
  create: vi.fn(),
  update: updateSessionMock,
  delete: vi.fn(),
  countByScenarioId: vi.fn(),
  countActiveByScenarioId: vi.fn(),
}

const avatarRepository = {
  findById: vi.fn(),
  create: vi.fn(),
  listByScenarioId: listAvatarsByScenarioIdMock,
  delete: vi.fn(),
}

const llm = { complete: completeMock }
const observability = { trace: traceMock, flush: flushMock }

function makeState(overrides: Partial<GameMasterState> = {}): GameMasterState {
  return {
    progression: 'progressing',
    topicsCovered: ['plastic'],
    interactionCount: 1,
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
    undefined, // scenarioRepository — not needed for unit tests
    eventLog,
  )
}

beforeEach(() => {
  findBySessionIdMock.mockReset()
  saveGmStateMock.mockReset()
  updateSessionMock.mockReset()
  listAvatarsByScenarioIdMock.mockReset()
  completeMock.mockReset()
  traceMock.mockReset()
  flushMock.mockReset()

  findBySessionIdMock.mockResolvedValue(makeState())
  saveGmStateMock.mockResolvedValue(undefined)
  updateSessionMock.mockResolvedValue(undefined)
  listAvatarsByScenarioIdMock.mockResolvedValue([makeAvatar()])
  completeMock.mockResolvedValue({
    content: JSON.stringify({
      avatarId: 'avatar_1',
      conversationMode: 'continue',
      context: { notes: 'Help the user move to concrete examples.' },
      stateUpdate: {
        progression: 'increase',
        topicCovered: 'ocean_cleanup',
        activeAvatarId: 'avatar_2',
        interactionIncrement: 1,
      },
    }),
    model: 'null-model',
    inputTokens: 10,
    outputTokens: 20,
    latencyMs: 4,
  })
  traceMock.mockResolvedValue(undefined)
  flushMock.mockResolvedValue(undefined)
})

describe('RunGameMasterUseCase', () => {
  it('increments state and skips llm when no trigger fires', async () => {
    const useCase = createUseCase()

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 2,
      correlationId: 'request_1',
    })

    expect(completeMock).not.toHaveBeenCalled()
    expect(saveGmStateMock).toHaveBeenCalledWith(
      'session_1',
      expect.objectContaining({ interactionCount: 2 }),
    )
    expect(updateSessionMock).not.toHaveBeenCalled()
  })

  it('calls llm, persists reduced state, stores notes, and updates active avatar when trigger fires', async () => {
    const useCase = createUseCase()
    findBySessionIdMock.mockResolvedValue(
      makeState({ interactionCount: 5, progression: 'none', currentAvatarId: 'avatar_1' }),
    )

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 6,
      correlationId: 'request_1',
    })

    expect(completeMock).toHaveBeenCalledTimes(1)
    expect(saveGmStateMock).toHaveBeenCalledWith(
      'session_1',
      expect.objectContaining({
        interactionCount: 6,
        progression: 'advanced',
        topicsCovered: ['plastic', 'ocean_cleanup'],
        currentAvatarId: 'avatar_2',
      }),
    )
    expect(updateSessionMock).toHaveBeenCalledWith('session_1', {
      gmNotes: 'Help the user move to concrete examples.',
    })
    expect(updateSessionMock).toHaveBeenCalledWith('session_1', {
      activeAvatarId: 'avatar_2',
    })
  })

  it('treats invalid llm output as no-trigger and only increments state', async () => {
    const useCase = createUseCase()
    findBySessionIdMock.mockResolvedValue(
      makeState({ interactionCount: 5, progression: 'none', currentAvatarId: 'avatar_1' }),
    )
    completeMock.mockResolvedValue({
      content: 'not-json',
      model: 'null-model',
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
    })

    await expectConsoleError(
      () =>
        useCase.execute({
          sessionId: 'session_1',
          scenarioId: 'scenario_1',
          avatarId: 'avatar_1',
          userMessageText: 'hello',
          turnIndex: 6,
          correlationId: 'request_1',
        }),
      /\[GM\] Failed to parse Game Master output JSON:/,
    )

    expect(saveGmStateMock).toHaveBeenCalledWith(
      'session_1',
      expect.objectContaining({ interactionCount: 6, progression: 'none' }),
    )
    expect(updateSessionMock).not.toHaveBeenCalled()
  })
})

describe('RunGameMasterUseCase — event log', () => {
  it('emits gm_skipped with correct fields when no trigger fires', async () => {
    const eventLog = new InMemoryEventLogRepository()
    const useCase = createUseCase(eventLog)

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 2,
      correlationId: 'corr_abc',
    })

    const events = eventLog.getAll()
    expect(events).toHaveLength(1)
    const event = events[0]
    expect(event).toBeDefined()
    expect(event?.type).toBe('gm_skipped')
    expect(event?.severity).toBe('info')
    expect(event?.sessionId).toBe('session_1')
    expect(event?.correlationId).toBe('corr_abc')
    expect(event?.payload['triggerReason']).toBeNull()
    expect(event?.payload['turnIndex']).toBe(2)
    expect(event?.payload['interactionCount']).toBe(2)
    expect(event?.payload).toHaveProperty('stateBefore')
    expect(event?.payload).toHaveProperty('latencyMs')
  })

  it('emits gm_triggered with decision and stateAfter when trigger fires', async () => {
    const eventLog = new InMemoryEventLogRepository()
    const useCase = createUseCase(eventLog)
    findBySessionIdMock.mockResolvedValue(
      makeState({ interactionCount: 5, progression: 'none', currentAvatarId: 'avatar_1' }),
    )

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 6,
      correlationId: 'corr_xyz',
    })

    const events = eventLog.getAll()
    expect(events).toHaveLength(1)
    const event = events[0]
    expect(event).toBeDefined()
    expect(event?.type).toBe('gm_triggered')
    expect(event?.severity).toBe('info')
    expect(event?.sessionId).toBe('session_1')
    expect(event?.correlationId).toBe('corr_xyz')
    expect(event?.payload['triggerReason']).toBe('turn_threshold')
    expect(event?.payload['turnIndex']).toBe(6)
    expect(event?.payload['decision']).toBeDefined()
    expect(event?.payload['stateAfter']).toBeDefined()
    expect(event?.payload).toHaveProperty('latencyMs')
  })

  it('gm_triggered payload does not include userMessageText or raw system prompt', async () => {
    const eventLog = new InMemoryEventLogRepository()
    const useCase = createUseCase(eventLog)
    findBySessionIdMock.mockResolvedValue(
      makeState({ interactionCount: 5, progression: 'none', currentAvatarId: 'avatar_1' }),
    )

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'secret user input',
      turnIndex: 6,
      correlationId: 'corr_sec',
    })

    const events = eventLog.getAll()
    const event = events[0]
    expect(event).toBeDefined()
    expect(JSON.stringify(event?.payload ?? {})).not.toContain('secret user input')
    expect(JSON.stringify(event?.payload ?? {})).not.toContain('systemPrompt')
  })
})

describe('RunGameMasterUseCase — LLM error handling', () => {
  it('does not propagate LlmError from execute(), increments state, emits gm_skipped', async () => {
    const eventLog = new InMemoryEventLogRepository()
    const useCase = createUseCase(eventLog)
    findBySessionIdMock.mockResolvedValue(
      makeState({ interactionCount: 5, progression: 'none', currentAvatarId: 'avatar_1' }),
    )
    completeMock.mockRejectedValue(new LlmError('null', 'provider down', 503))

    await expectConsoleError(
      () =>
        useCase.execute({
          sessionId: 'session_1',
          scenarioId: 'scenario_1',
          avatarId: 'avatar_1',
          userMessageText: 'hello',
          turnIndex: 6,
          correlationId: 'corr_err',
        }),
      /\[GM\] LLM call failed:/,
    )

    expect(saveGmStateMock).toHaveBeenCalledWith(
      'session_1',
      expect.objectContaining({ interactionCount: 6 }),
    )
    expect(updateSessionMock).not.toHaveBeenCalled()

    const events = eventLog.getAll()
    expect(events).toHaveLength(1)
    expect(events[0]?.type).toBe('gm_skipped')
    expect(events[0]?.payload['triggerReason']).toBe('turn_threshold')
  })
})

describe('RunGameMasterUseCase — defensive error paths', () => {
  it('emitEventSafe failure does not propagate and execute() still resolves', async () => {
    const failingEventLog = {
      append: vi.fn().mockRejectedValue(new Error('db write failed')),
    }
    const useCase = new RunGameMasterUseCase(
      gmStateRepository,
      sessionRepository,
      avatarRepository,
      llm,
      observability,
      undefined,
      failingEventLog,
    )

    // A skipped turn (no trigger) still calls emitEventSafe — verify no throw
    await expectConsoleError(
      () =>
        useCase.execute({
          sessionId: 'session_1',
          scenarioId: 'scenario_1',
          avatarId: 'avatar_1',
          userMessageText: 'hello',
          turnIndex: 2,
          correlationId: 'corr_safe',
        }),
      /\[GM\] Event log emission failed for type:/,
    )

    expect(failingEventLog.append).toHaveBeenCalledTimes(1)
    expect(saveGmStateMock).toHaveBeenCalledOnce()
  })

  it('traceSafe failure does not propagate on triggered turn', async () => {
    traceMock.mockRejectedValue(new Error('langfuse down'))
    findBySessionIdMock.mockResolvedValue(
      makeState({ interactionCount: 5, progression: 'none', currentAvatarId: 'avatar_1' }),
    )
    const useCase = createUseCase()

    await expectConsoleError(
      () =>
        useCase.execute({
          sessionId: 'session_1',
          scenarioId: 'scenario_1',
          avatarId: 'avatar_1',
          userMessageText: 'hello',
          turnIndex: 6,
          correlationId: 'corr_trace',
        }),
      /\[GM\] Observability trace failed for event:/,
    )

    expect(completeMock).toHaveBeenCalledTimes(1)
    expect(saveGmStateMock).toHaveBeenCalledOnce()
  })

  it('does not update session when activeAvatarId is unchanged', async () => {
    findBySessionIdMock.mockResolvedValue(
      makeState({ interactionCount: 5, progression: 'none', currentAvatarId: 'avatar_1' }),
    )
    // LLM returns activeAvatarId = same avatar already active
    completeMock.mockResolvedValue({
      content: JSON.stringify({
        avatarId: 'avatar_1',
        conversationMode: 'continue',
        stateUpdate: {
          activeAvatarId: 'avatar_1',
          interactionIncrement: 1,
        },
      }),
      model: 'null-model',
      inputTokens: 5,
      outputTokens: 5,
      latencyMs: 1,
    })
    const useCase = createUseCase()

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 6,
      correlationId: 'corr_unchanged',
    })

    // Session should NOT be updated for activeAvatarId when it has not changed
    const avatarUpdateCalls = updateSessionMock.mock.calls.filter(
      (call) => (call[1] as Record<string, unknown>)['activeAvatarId'] !== undefined,
    )
    expect(avatarUpdateCalls).toHaveLength(0)
  })
})

describe('RunGameMasterUseCase — scenario policy wiring', () => {
  const findByIdScenarioMock = vi.fn()

  const scenarioRepository = {
    findById: findByIdScenarioMock,
    create: vi.fn(),
    list: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  }

  function createUseCaseWithScenario(eventLog?: InMemoryEventLogRepository): RunGameMasterUseCase {
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
    findByIdScenarioMock.mockReset()
    findByIdScenarioMock.mockResolvedValue(null)
  })

  it('returns empty context when scenarioRepository returns null', async () => {
    // scenario not found → triggers still evaluate against default policy
    findByIdScenarioMock.mockResolvedValue(null)
    findBySessionIdMock.mockResolvedValue(makeState({ interactionCount: 1 }))

    await createUseCaseWithScenario().execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_missing',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 2,
      correlationId: 'corr_null_scenario',
    })

    expect(completeMock).not.toHaveBeenCalled()
    expect(saveGmStateMock).toHaveBeenCalledWith(
      'session_1',
      expect.objectContaining({ interactionCount: 2 }),
    )
  })

  it('uses custom policy from scenario config when scenario is found', async () => {
    // turnThreshold of 2 means interactionCount=2 fires a trigger
    findByIdScenarioMock.mockResolvedValue({
      scenarioId: 'scenario_1',
      name: 'Test',
      status: 'active',
      config: { policy: { turnThreshold: 2 } },
      createdAt: '',
      updatedAt: '',
    })
    findBySessionIdMock.mockResolvedValue(makeState({ interactionCount: 2, progression: 'none' }))

    await createUseCaseWithScenario().execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 3,
      correlationId: 'corr_policy',
    })

    expect(completeMock).toHaveBeenCalledTimes(1)
  })

  it('ignores invalid policy values (non-positive integer) and falls back to defaults', async () => {
    findByIdScenarioMock.mockResolvedValue({
      scenarioId: 'scenario_1',
      name: 'Test',
      status: 'active',
      config: { policy: { turnThreshold: -5, maxTopicRepeatCount: 1.5 } },
      createdAt: '',
      updatedAt: '',
    })
    // With default turnThreshold=5, interactionCount=3 should NOT trigger
    findBySessionIdMock.mockResolvedValue(makeState({ interactionCount: 3 }))

    await createUseCaseWithScenario().execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 4,
      correlationId: 'corr_bad_policy',
    })

    expect(completeMock).not.toHaveBeenCalled()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { GameMasterState } from '../../../domain/game-master/game-master.types.js'
import { expectConsoleError } from '../../../test-utils/console.js'
import { RunGameMasterUseCase } from './run-game-master.use-case.js'

const findBySessionIdMock = vi.fn()
const saveGmStateMock = vi.fn()
const updateSessionMock = vi.fn()
const listAvatarsByScenarioIdMock = vi.fn()
const completeMock = vi.fn()
const traceMock = vi.fn()

const gmStateRepository = {
  findBySessionId: findBySessionIdMock,
  save: saveGmStateMock,
}

const sessionRepository = {
  findById: vi.fn(),
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
  saveComputedTraits: vi.fn(),
}

const llm = { complete: completeMock }
const observability = { trace: traceMock, flush: vi.fn() }

function makeState(overrides: Partial<GameMasterState> = {}): GameMasterState {
  return {
    progression: 'none',
    topicsCovered: [],
    interactionCount: 5,
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

function createUseCase(eventLog?: {
  append: ReturnType<typeof vi.fn>
  findBySessionId: ReturnType<typeof vi.fn>
}): RunGameMasterUseCase {
  return new RunGameMasterUseCase(
    gmStateRepository,
    sessionRepository,
    avatarRepository,
    llm,
    observability,
    undefined,
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

  findBySessionIdMock.mockResolvedValue(makeState())
  saveGmStateMock.mockResolvedValue(undefined)
  updateSessionMock.mockResolvedValue(undefined)
  listAvatarsByScenarioIdMock.mockResolvedValue([makeAvatar()])
  completeMock.mockResolvedValue({
    content: JSON.stringify({
      dialogueControl: { mode: 'avatar_guided', askFollowUp: false },
      retrievalPlan: { required: false },
      directorNotes: 'Keep the next answer focused on the current subject.',
      progressionUpdate: { progression: 'none' },
    }),
    model: 'null-model',
    inputTokens: 5,
    outputTokens: 5,
    latencyMs: 1,
  })
  traceMock.mockResolvedValue(undefined)
})

describe('RunGameMasterUseCase — defensive error paths', () => {
  it('emitEventSafe failure does not propagate and execute() still resolves', async () => {
    const failingEventLog = {
      append: vi.fn().mockRejectedValue(new Error('db write failed')),
      findBySessionId: vi.fn(),
    }
    const useCase = createUseCase(failingEventLog)

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

  it('traceSafe failure does not propagate on invalid output path', async () => {
    completeMock.mockResolvedValueOnce({
      content: '{invalid_json',
      model: 'null-model',
      inputTokens: 5,
      outputTokens: 5,
      latencyMs: 1,
    })
    traceMock.mockRejectedValue(new Error('langfuse down'))
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
    expect(saveGmStateMock).not.toHaveBeenCalled()
  })

  it('does not update session when activeAvatarId is unchanged', async () => {
    const useCase = createUseCase()

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 6,
      correlationId: 'corr_unchanged',
    })

    const avatarUpdateCalls = updateSessionMock.mock.calls.filter(
      (call) => (call[1] as Record<string, unknown>)['activeAvatarId'] !== undefined,
    )
    expect(avatarUpdateCalls).toHaveLength(0)
  })
})

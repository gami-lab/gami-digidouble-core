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

function createUseCase(): RunGameMasterUseCase {
  return new RunGameMasterUseCase(
    gmStateRepository,
    sessionRepository,
    avatarRepository,
    llm,
    observability,
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

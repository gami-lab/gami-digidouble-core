import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '../../../domain/conversation/session.types.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import type { DomainError } from '../../../domain/errors.js'
import { StartSessionUseCase } from './start-session.use-case.js'

const createSessionMock = vi.fn()
const findScenarioByIdMock = vi.fn()

const sessionRepository = {
  findById: vi.fn(),
  create: createSessionMock,
  update: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
  countByScenarioId: vi.fn(),
  countActiveByScenarioId: vi.fn(),
}

const scenarioRepository = {
  create: vi.fn(),
  findById: findScenarioByIdMock,
  list: vi.fn(),
  delete: vi.fn(),
  update: vi.fn(),
}

const listAvatarsByScenarioIdMock = vi.fn()

const avatarRepository = {
  findById: vi.fn(),
  create: vi.fn(),
  listByScenarioId: listAvatarsByScenarioIdMock,
  delete: vi.fn(),
  update: vi.fn(),
  saveComputedTraits: vi.fn(),
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    status: 'active',
    startedAt: '2026-04-19T10:00:00.000Z',
    lastActivityAt: '2026-04-19T10:00:00.000Z',

    ...overrides,
  }
}

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    scenarioId: 'scenario_1',
    name: 'Scenario',
    status: 'active',
    objectives: [],
    worldContext: '',
    avatarAvailability: { initialAvatarIds: [] },
    config: {},
    createdAt: '2026-04-19T10:00:00.000Z',
    updatedAt: '2026-04-19T10:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  createSessionMock.mockReset()
  findScenarioByIdMock.mockReset()
  listAvatarsByScenarioIdMock.mockReset()
  createSessionMock.mockResolvedValue(makeSession())
  findScenarioByIdMock.mockResolvedValue(makeScenario())
  listAvatarsByScenarioIdMock.mockResolvedValue([])
})

describe('StartSessionUseCase', () => {
  it('throws VALIDATION_ERROR for blank userId', async () => {
    const useCase = new StartSessionUseCase(sessionRepository, scenarioRepository, avatarRepository)

    await expect(useCase.execute({ userId: ' ', scenarioId: 'scenario_1' })).rejects.toEqual(
      expect.objectContaining<Partial<DomainError>>({ code: 'VALIDATION_ERROR' }),
    )
  })

  it('throws VALIDATION_ERROR for blank scenarioId', async () => {
    const useCase = new StartSessionUseCase(sessionRepository, scenarioRepository, avatarRepository)

    await expect(useCase.execute({ userId: 'user_1', scenarioId: ' ' })).rejects.toEqual(
      expect.objectContaining<Partial<DomainError>>({ code: 'VALIDATION_ERROR' }),
    )
  })

  it('throws NOT_FOUND when scenario does not exist', async () => {
    const useCase = new StartSessionUseCase(sessionRepository, scenarioRepository, avatarRepository)
    findScenarioByIdMock.mockResolvedValue(null)

    await expect(useCase.execute({ userId: 'user_1', scenarioId: 'missing' })).rejects.toEqual(
      expect.objectContaining<Partial<DomainError>>({ code: 'NOT_FOUND' }),
    )
  })

  it("creates and returns an 'active' session for valid input", async () => {
    const useCase = new StartSessionUseCase(sessionRepository, scenarioRepository, avatarRepository)
    createSessionMock.mockResolvedValue(
      makeSession({
        sessionId: 'session_abc',
        userId: 'user_abc',
        scenarioId: 'scenario_abc',
        status: 'active',
      }),
    )

    const output = await useCase.execute({
      userId: '  user_abc  ',
      scenarioId: '  scenario_abc  ',
    })

    expect(createSessionMock).toHaveBeenCalledWith({
      userId: 'user_abc',
      scenarioId: 'scenario_abc',
    })
    expect(findScenarioByIdMock).toHaveBeenCalledWith('scenario_abc')
    expect(output.session).toMatchObject({
      sessionId: 'session_abc',
      userId: 'user_abc',
      scenarioId: 'scenario_abc',
      status: 'active',
    })
  })

  it('persists session-scoped Avatar retrieval options', async () => {
    const useCase = new StartSessionUseCase(sessionRepository, scenarioRepository, avatarRepository)
    const avatarOptions = {
      retrieval: {
        maxChunks: 7,
        minimumChunksBySource: { gm_required_fact: 2 },
      },
    }
    createSessionMock.mockResolvedValue(makeSession({ avatarOptions }))

    const output = await useCase.execute({
      userId: 'user_1',
      scenarioId: 'scenario_1',
      avatarOptions,
    })

    expect(createSessionMock).toHaveBeenCalledWith({
      userId: 'user_1',
      scenarioId: 'scenario_1',
      avatarOptions,
    })
    expect(output.session.avatarOptions).toEqual(avatarOptions)
  })
})

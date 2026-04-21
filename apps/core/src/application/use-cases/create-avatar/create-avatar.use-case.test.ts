import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import type { DomainError } from '../../../domain/errors.js'
import { CreateAvatarUseCase } from './create-avatar.use-case.js'

const findScenarioByIdMock = vi.fn()
const createAvatarMock = vi.fn()

const scenarioRepository = {
  create: vi.fn(),
  findById: findScenarioByIdMock,
}

const avatarRepository = {
  create: createAvatarMock,
  findById: vi.fn(),
}

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    scenarioId: 'scenario_1',
    name: 'Scenario',
    status: 'active',
    config: {},
    createdAt: '2026-04-19T10:00:00.000Z',
    updatedAt: '2026-04-19T10:00:00.000Z',
    ...overrides,
  }
}

function makeAvatarConfig(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
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

beforeEach(() => {
  findScenarioByIdMock.mockReset()
  createAvatarMock.mockReset()

  findScenarioByIdMock.mockResolvedValue(makeScenario())
  createAvatarMock.mockResolvedValue(makeAvatarConfig())
})

describe('CreateAvatarUseCase', () => {
  it('throws VALIDATION_ERROR for blank name', async () => {
    const useCase = new CreateAvatarUseCase(scenarioRepository, avatarRepository)

    await expect(
      useCase.execute({
        scenarioId: 'scenario_1',
        name: ' ',
        personaPrompt: 'You are Ava.',
      }),
    ).rejects.toEqual(expect.objectContaining<Partial<DomainError>>({ code: 'VALIDATION_ERROR' }))
  })

  it('throws VALIDATION_ERROR for blank personaPrompt', async () => {
    const useCase = new CreateAvatarUseCase(scenarioRepository, avatarRepository)

    await expect(
      useCase.execute({
        scenarioId: 'scenario_1',
        name: 'Ava',
        personaPrompt: ' ',
      }),
    ).rejects.toEqual(expect.objectContaining<Partial<DomainError>>({ code: 'VALIDATION_ERROR' }))
  })

  it('throws NOT_FOUND when scenario does not exist', async () => {
    const useCase = new CreateAvatarUseCase(scenarioRepository, avatarRepository)
    findScenarioByIdMock.mockResolvedValue(null)

    await expect(
      useCase.execute({
        scenarioId: 'missing',
        name: 'Ava',
        personaPrompt: 'You are Ava.',
      }),
    ).rejects.toEqual(expect.objectContaining<Partial<DomainError>>({ code: 'NOT_FOUND' }))
  })

  it('returns avatar with defaults when optional fields are omitted', async () => {
    const useCase = new CreateAvatarUseCase(scenarioRepository, avatarRepository)
    createAvatarMock.mockResolvedValue(
      makeAvatarConfig({
        avatarId: 'avatar_abc',
        scenarioId: 'scenario_1',
        name: 'Ava',
        status: 'active',
      }),
    )

    const output = await useCase.execute({
      scenarioId: 'scenario_1',
      name: '  Ava  ',
      personaPrompt: '  You are Ava.  ',
    })

    expect(createAvatarMock).toHaveBeenCalledWith({
      scenarioId: 'scenario_1',
      name: 'Ava',
      personaPrompt: 'You are Ava.',
      status: 'active',
    })
    expect(output.avatar).toMatchObject({
      avatarId: 'avatar_abc',
      scenarioId: 'scenario_1',
      name: 'Ava',
      status: 'active',
      personaPrompt: 'You are Ava.',
    })
    expect(output.avatar.tone).toBeUndefined()
    expect(output.avatar.description).toBeUndefined()
    expect(output.avatar.adjustments).toBeUndefined()
  })
})

describe('CreateAvatarUseCase — optional fields', () => {
  it('passes optional fields (tone, description, adjustments) through to repository and output', async () => {
    const useCase = new CreateAvatarUseCase(scenarioRepository, avatarRepository)
    createAvatarMock.mockResolvedValue(
      makeAvatarConfig({
        avatarId: 'avatar_opt',
        name: 'Lex',
        personaPrompt: 'You are Lex.',
        tone: 'formal',
        description: 'A formal legal assistant.',
        adjustments: ['Use concise sentences.', 'Avoid jargon.'],
      }),
    )

    const output = await useCase.execute({
      scenarioId: 'scenario_1',
      name: 'Lex',
      personaPrompt: 'You are Lex.',
      tone: 'formal',
      description: 'A formal legal assistant.',
      adjustments: ['Use concise sentences.', 'Avoid jargon.'],
    })

    expect(createAvatarMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: 'formal',
        description: 'A formal legal assistant.',
        adjustments: ['Use concise sentences.', 'Avoid jargon.'],
      }),
    )
    expect(output.avatar.tone).toBe('formal')
    expect(output.avatar.description).toBe('A formal legal assistant.')
    expect(output.avatar.adjustments).toEqual(['Use concise sentences.', 'Avoid jargon.'])
  })
})

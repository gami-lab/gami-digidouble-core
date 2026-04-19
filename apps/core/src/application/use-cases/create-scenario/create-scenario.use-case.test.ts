import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import type { DomainError } from '../../../domain/errors.js'
import { CreateScenarioUseCase } from './create-scenario.use-case.js'

const createMock = vi.fn()

const scenarioRepository = {
  create: createMock,
  findById: vi.fn(),
}

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    scenarioId: 'scenario_1',
    name: 'Demo',
    slug: 'demo',
    status: 'draft',
    config: {},
    createdAt: '2026-04-19T10:00:00.000Z',
    updatedAt: '2026-04-19T10:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  createMock.mockReset()
  createMock.mockResolvedValue(makeScenario())
})

describe('CreateScenarioUseCase', () => {
  it('throws VALIDATION_ERROR for blank name', async () => {
    const useCase = new CreateScenarioUseCase(scenarioRepository)

    await expect(useCase.execute({ name: '   ', slug: 'valid-slug' })).rejects.toEqual(
      expect.objectContaining<Partial<DomainError>>({ code: 'VALIDATION_ERROR' }),
    )
  })

  it('throws VALIDATION_ERROR for invalid slug pattern', async () => {
    const useCase = new CreateScenarioUseCase(scenarioRepository)

    await expect(useCase.execute({ name: 'Demo', slug: 'Invalid Slug' })).rejects.toEqual(
      expect.objectContaining<Partial<DomainError>>({ code: 'VALIDATION_ERROR' }),
    )
  })

  it('throws VALIDATION_ERROR for invalid status value', async () => {
    const useCase = new CreateScenarioUseCase(scenarioRepository)

    await expect(
      useCase.execute({
        name: 'Demo',
        slug: 'demo',
        status: 'paused' as unknown as Scenario['status'],
      }),
    ).rejects.toEqual(expect.objectContaining<Partial<DomainError>>({ code: 'VALIDATION_ERROR' }))
  })

  it('returns scenario summary for valid input', async () => {
    const useCase = new CreateScenarioUseCase(scenarioRepository)
    createMock.mockResolvedValue(
      makeScenario({
        scenarioId: 'scenario_abc',
        name: 'Demo Name',
        slug: 'demo-name',
        status: 'active',
      }),
    )

    const output = await useCase.execute({
      name: '  Demo Name  ',
      slug: '  demo-name  ',
      status: 'active',
    })

    expect(createMock).toHaveBeenCalledWith({
      name: 'Demo Name',
      slug: 'demo-name',
      status: 'active',
    })
    expect(output.scenario).toMatchObject({
      scenarioId: 'scenario_abc',
      name: 'Demo Name',
      slug: 'demo-name',
      status: 'active',
    })
  })
})

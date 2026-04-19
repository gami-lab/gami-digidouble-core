import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import type { CreateScenarioInput, CreateScenarioOutput } from './create-scenario.types.js'

const SCENARIO_SLUG_PATTERN = /^[a-z0-9-]+$/
const ALLOWED_SCENARIO_STATUSES: ReadonlySet<Scenario['status']> = new Set([
  'draft',
  'active',
  'archived',
])

export class CreateScenarioUseCase {
  constructor(private readonly scenarioRepository: IScenarioRepository) {}

  async execute(input: CreateScenarioInput): Promise<CreateScenarioOutput> {
    const name = input.name.trim()
    const slug = input.slug.trim()

    if (name.length === 0) {
      throw new DomainError('VALIDATION_ERROR', 'name must be a non-empty string.')
    }
    if (slug.length === 0) {
      throw new DomainError('VALIDATION_ERROR', 'slug must be a non-empty string.')
    }
    if (!SCENARIO_SLUG_PATTERN.test(slug)) {
      throw new DomainError(
        'VALIDATION_ERROR',
        'slug must contain only lowercase letters, numbers, and hyphens.',
      )
    }

    const status = input.status ?? 'draft'
    if (!ALLOWED_SCENARIO_STATUSES.has(status)) {
      throw new DomainError('VALIDATION_ERROR', 'status must be one of: draft, active, archived.')
    }

    const scenario = await this.scenarioRepository.create({
      name,
      slug,
      status,
      ...(input.config !== undefined ? { config: input.config } : {}),
    })

    return {
      scenario: {
        scenarioId: scenario.scenarioId,
        name: scenario.name,
        slug: scenario.slug,
        status: scenario.status,
        config: scenario.config as Record<string, unknown>,
        createdAt: scenario.createdAt,
        updatedAt: scenario.updatedAt,
      },
    }
  }
}

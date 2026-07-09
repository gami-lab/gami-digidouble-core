import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type { CreateScenarioInput, CreateScenarioOutput } from './create-scenario.types.js'

const ALLOWED_SCENARIO_STATUSES: ReadonlySet<CreateScenarioOutput['scenario']['status']> = new Set([
  'draft',
  'active',
  'archived',
])

export class CreateScenarioUseCase {
  constructor(private readonly scenarioRepository: IScenarioRepository) {}

  async execute(input: CreateScenarioInput): Promise<CreateScenarioOutput> {
    const name = input.name.trim()

    if (name.length === 0) {
      throw new DomainError('VALIDATION_ERROR', 'name must be a non-empty string.')
    }

    const status = input.status ?? 'draft'
    if (!ALLOWED_SCENARIO_STATUSES.has(status)) {
      throw new DomainError('VALIDATION_ERROR', 'status must be one of: draft, active, archived.')
    }

    const scenario = await this.scenarioRepository.create({
      name,
      status,
      objectives: input.objectives ?? [],
      worldContext: input.worldContext ?? '',
      avatarAvailability: input.avatarAvailability ?? { initialAvatarIds: [] },
      ...(input.modelSelection !== undefined ? { modelSelection: input.modelSelection } : {}),
      ...(input.config !== undefined ? { config: input.config } : {}),
    })

    return {
      scenario: {
        scenarioId: scenario.scenarioId,
        name: scenario.name,
        status: scenario.status,
        objectives: scenario.objectives,
        worldContext: scenario.worldContext,
        avatarAvailability: scenario.avatarAvailability,
        ...(scenario.modelSelection !== undefined
          ? { modelSelection: scenario.modelSelection }
          : {}),
        config: scenario.config as Record<string, unknown>,
        createdAt: scenario.createdAt,
        updatedAt: scenario.updatedAt,
      },
    }
  }
}

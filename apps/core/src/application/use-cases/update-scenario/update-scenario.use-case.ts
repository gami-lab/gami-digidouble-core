import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type { UpdateScenarioInput, UpdateScenarioOutput } from './update-scenario.types.js'

export class UpdateScenarioUseCase {
  constructor(private readonly scenarioRepository: IScenarioRepository) {}

  async execute(input: UpdateScenarioInput): Promise<UpdateScenarioOutput> {
    const { scenarioId, name, status, config } = input

    if (name === undefined && status === undefined && config === undefined) {
      throw new DomainError('INVALID_INPUT', 'At least one field must be provided for update')
    }

    const updates = {
      ...(name !== undefined ? { name } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(config !== undefined ? { config } : {}),
    }

    const scenario = await this.scenarioRepository.update(scenarioId, updates)
    return { scenario }
  }
}

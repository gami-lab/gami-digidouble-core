import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import type { ListScenariosOutput } from './list-scenarios.types.js'

export class ListScenariosUseCase {
  constructor(private readonly scenarioRepository: IScenarioRepository) {}

  async execute(): Promise<ListScenariosOutput> {
    const scenarios = await this.scenarioRepository.list()
    return {
      scenarios: scenarios.map((scenario) => ({
        scenarioId: scenario.scenarioId,
        name: scenario.name,
        status: scenario.status,
        config: scenario.config,
        createdAt: scenario.createdAt,
        updatedAt: scenario.updatedAt,
      })),
    }
  }
}

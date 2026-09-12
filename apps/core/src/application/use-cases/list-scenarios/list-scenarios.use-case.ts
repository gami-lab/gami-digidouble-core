import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import type { ListScenariosOutput } from './list-scenarios.types.js'
import { toScenarioSummary } from '../shared/scenario-summary.js'

export class ListScenariosUseCase {
  constructor(private readonly scenarioRepository: IScenarioRepository) {}

  async execute(): Promise<ListScenariosOutput> {
    const scenarios = await this.scenarioRepository.list()
    return {
      scenarios: scenarios.map(toScenarioSummary),
    }
  }
}

import type { Scenario } from '../../domain/scenario/scenario.types.js'

export interface IScenarioRepository {
  create(params: CreateScenarioParams): Promise<Scenario>
  findById(scenarioId: string): Promise<Scenario | null>
  list(): Promise<Scenario[]>
  delete(scenarioId: string): Promise<void>
}

export interface CreateScenarioParams {
  name: string
  status?: Scenario['status']
  config?: Record<string, unknown>
}

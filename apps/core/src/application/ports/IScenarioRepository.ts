import type { Scenario, ScenarioStatus } from '../../domain/scenario/scenario.types.js'

export interface IScenarioRepository {
  create(params: CreateScenarioParams): Promise<Scenario>
  findById(scenarioId: string): Promise<Scenario | null>
  list(): Promise<Scenario[]>
  delete(scenarioId: string): Promise<void>
  update(scenarioId: string, updates: UpdateScenarioParams): Promise<Scenario>
}

export interface CreateScenarioParams {
  name: string
  status?: ScenarioStatus
  config?: Record<string, unknown>
}

export type UpdateScenarioParams = {
  name?: string
  status?: ScenarioStatus
  config?: Record<string, unknown>
}

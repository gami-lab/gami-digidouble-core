import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import type { ScenarioStatus } from '../../../domain/scenario/scenario.types.js'

export type UpdateScenarioInput = {
  scenarioId: string
  name?: string
  status?: ScenarioStatus
  config?: Record<string, unknown>
}

export type UpdateScenarioOutput = {
  scenario: Scenario
}

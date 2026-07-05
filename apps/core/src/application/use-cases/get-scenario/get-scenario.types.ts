import type { Scenario } from '../../../domain/scenario/scenario.types.js'

export type GetScenarioInput = {
  scenarioId: string
}

export type GetScenarioOutput = {
  scenario: Scenario
}

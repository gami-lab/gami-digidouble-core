import type { Scenario } from '../../../domain/scenario/scenario.types.js'

export type UpdateScenarioInput = {
  scenarioId: string
  name?: string
  status?: 'draft' | 'active' | 'archived'
  config?: Record<string, unknown>
}

export type UpdateScenarioOutput = {
  scenario: Scenario
}

import type { Scenario } from '../../../domain/scenario/scenario.types.js'

export interface CreateScenarioInput {
  name: string
  slug: string
  status?: Scenario['status']
  config?: Record<string, unknown>
}

export interface CreateScenarioOutput {
  scenario: {
    scenarioId: string
    name: string
    slug: string
    status: Scenario['status']
    config: Record<string, unknown>
    createdAt: string
    updatedAt: string
  }
}

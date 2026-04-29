import type { ScenarioSummary } from '@gami/shared'
import type { ScenarioStatus } from '../../../domain/scenario/scenario.types.js'

export interface CreateScenarioInput {
  name: string
  status?: ScenarioStatus
  config?: Record<string, unknown>
}

export interface CreateScenarioOutput {
  scenario: ScenarioSummary
}

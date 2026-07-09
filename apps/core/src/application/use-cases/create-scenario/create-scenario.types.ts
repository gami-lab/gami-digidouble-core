import type { ScenarioSummary } from '@gami/shared'
import type { ScenarioModelSelection } from '@gami/shared'
import type {
  ScenarioAvatarAvailabilityConfig,
  ScenarioStatus,
} from '../../../domain/scenario/scenario.types.js'

export interface CreateScenarioInput {
  name: string
  status?: ScenarioStatus
  objectives?: string[]
  worldContext?: string
  avatarAvailability?: ScenarioAvatarAvailabilityConfig
  modelSelection?: ScenarioModelSelection
  config?: Record<string, unknown>
}

export interface CreateScenarioOutput {
  scenario: ScenarioSummary
}

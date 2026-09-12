import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import type { ScenarioModelSelection, VoiceConfigurationUpdate } from '@gami/shared'
import type {
  ScenarioAvatarAvailabilityConfig,
  ScenarioStatus,
} from '../../../domain/scenario/scenario.types.js'

export type UpdateScenarioInput = {
  scenarioId: string
  name?: string
  status?: ScenarioStatus
  objectives?: string[]
  worldContext?: string
  avatarAvailability?: ScenarioAvatarAvailabilityConfig
  modelSelection?: ScenarioModelSelection | null
  voiceConfig?: VoiceConfigurationUpdate
  config?: Record<string, unknown>
}

export type UpdateScenarioOutput = {
  scenario: Scenario
}

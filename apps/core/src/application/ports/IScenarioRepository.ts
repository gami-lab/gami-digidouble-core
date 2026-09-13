import type {
  Scenario,
  ScenarioAvatarAvailabilityConfig,
  ScenarioStatus,
} from '../../domain/scenario/scenario.types.js'
import type {
  ScenarioModelSelection,
  VoiceConfiguration,
  VoiceConfigurationUpdate,
} from '@gami/shared'

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
  language?: string
  objectives?: string[]
  worldContext?: string
  avatarAvailability?: ScenarioAvatarAvailabilityConfig
  modelSelection?: ScenarioModelSelection
  voiceConfig?: VoiceConfiguration
  config?: Record<string, unknown>
}

export type UpdateScenarioParams = {
  name?: string
  status?: ScenarioStatus
  language?: string
  objectives?: string[]
  worldContext?: string
  avatarAvailability?: ScenarioAvatarAvailabilityConfig
  modelSelection?: ScenarioModelSelection | null
  voiceConfig?: VoiceConfigurationUpdate
  config?: Record<string, unknown>
}

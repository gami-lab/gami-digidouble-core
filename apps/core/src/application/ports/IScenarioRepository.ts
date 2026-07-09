import type {
  Scenario,
  ScenarioAvatarAvailabilityConfig,
  ScenarioStatus,
} from '../../domain/scenario/scenario.types.js'
import type { ScenarioModelSelection } from '@gami/shared'

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
  objectives?: string[]
  worldContext?: string
  avatarAvailability?: ScenarioAvatarAvailabilityConfig
  modelSelection?: ScenarioModelSelection
  config?: Record<string, unknown>
}

export type UpdateScenarioParams = {
  name?: string
  status?: ScenarioStatus
  objectives?: string[]
  worldContext?: string
  avatarAvailability?: ScenarioAvatarAvailabilityConfig
  modelSelection?: ScenarioModelSelection | null
  config?: Record<string, unknown>
}

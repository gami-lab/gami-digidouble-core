import type { ScenarioModelSelection } from '@gami/shared'

/**
 * Scenario domain types.
 *
 * A Scenario is a config-driven experience template.
 * It defines which avatars are available, the world context,
 * objectives, and linked knowledge sources.
 */
export type ScenarioStatus = 'draft' | 'active' | 'archived'

export interface Scenario {
  scenarioId: string
  name: string
  status: ScenarioStatus
  /** Learning or engagement objectives. Always present (defaults to []). */
  objectives: string[]
  /** World/experience description injected into context. Always present (defaults to ''). */
  worldContext: string
  /** Session-scoped avatar availability policy. Always present. */
  avatarAvailability: ScenarioAvatarAvailabilityConfig
  /** Optional scenario-scoped model defaults and overrides. Persisted in its own column, never nested in config. */
  modelSelection?: ScenarioModelSelection
  config: ScenarioConfig
  createdAt: string
  updatedAt: string
}

export interface ScenarioConfig {
  /** Additional scenario goals, merged alongside root-level objectives. */
  goals?: string[]
  /** Scenario runtime defaults for adapters and clients. */
  runtimeDefaults?: Record<string, unknown>
  /** Optional UI-only hints; ignored by Core orchestration. */
  uiHints?: Record<string, unknown>
}

export interface ScenarioAvatarAvailabilityConfig {
  initialAvatarIds: string[]
  unlockableAvatarIds?: string[]
}

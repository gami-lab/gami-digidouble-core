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
  config: ScenarioConfig
  createdAt: string
  updatedAt: string
}

export interface ScenarioConfig {
  /** World/experience description injected into context. */
  worldContext?: string
  /** Learning or engagement objectives. */
  objectives?: string[]
  /** Additional scenario goals. */
  goals?: string[]
  /** Session-scoped avatar availability policy. */
  avatarAvailability?: ScenarioAvatarAvailabilityConfig
  /** Scenario runtime defaults for adapters and clients. */
  runtimeDefaults?: Record<string, unknown>
  /** Optional UI-only hints; ignored by Core orchestration. */
  uiHints?: Record<string, unknown>
}

export interface ScenarioAvatarAvailabilityConfig {
  initialAvatarKeys: string[]
  unlockableAvatarKeys?: string[]
}

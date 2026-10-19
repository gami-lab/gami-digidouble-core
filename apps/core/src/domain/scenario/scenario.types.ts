import type { ScenarioModelSelection, ScenarioPresentation, VoiceConfiguration } from '@gami/shared'

export type ScenarioStatus = 'draft' | 'active' | 'archived'

export interface Scenario {
  scenarioId: string
  name: string
  status: ScenarioStatus
  /** Canonical language for Avatar responses and all voice operations. */
  language?: string
  /** Learning or engagement objectives. Always present (defaults to []). */
  objectives: string[]
  /** World/experience description injected into context. Always present (defaults to ''). */
  worldContext: string
  /** Session-scoped avatar availability policy. Always present. */
  avatarAvailability: ScenarioAvatarAvailabilityConfig
  /** Optional scenario-scoped model defaults and overrides. Persisted in its own column, never nested in config. */
  modelSelection?: ScenarioModelSelection
  /** Provider-neutral default voice projected from the reserved config section. */
  voiceConfig?: VoiceConfiguration
  config: ScenarioConfig
  createdAt: string
  updatedAt: string
}

export interface ScenarioConfig {
  /** Additional scenario goals, merged alongside root-level objectives. */
  goals?: string[]
  /** Scenario runtime defaults for adapters and clients. */
  runtimeDefaults?: Record<string, unknown>
  /** Player presentation; ignored by Core orchestration. */
  uiHints?: ScenarioPresentation
}

export interface ScenarioAvatarAvailabilityConfig {
  initialAvatarIds: string[]
  unlockableAvatarIds?: string[]
}

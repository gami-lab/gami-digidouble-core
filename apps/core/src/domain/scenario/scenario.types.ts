import type { AvatarTransitionRule } from '../avatar/avatar-transition.types.js'

/**
 * Scenario domain types.
 *
 * A Scenario is a config-driven experience template.
 * It defines which avatars are available, the world context,
 * objectives, and linked knowledge sources.
 */
export interface Scenario {
  scenarioId: string
  name: string
  status: 'draft' | 'active' | 'archived'
  config: ScenarioConfig
  createdAt: string
  updatedAt: string
}

export interface ScenarioConfig {
  /** Avatar persona override for this scenario. */
  avatarPrompt?: string
  /** World/experience description injected into context. */
  worldContext?: string
  /** Learning or engagement objectives. */
  objectives?: string[]
  /** Feature flags for this scenario. */
  enabledFeatures?: string[]
  /** IDs of knowledge sources linked to this scenario. */
  sourceReferences?: string[]
  /** Avatar routing rules evaluated by the transition engine. */
  avatarTransitionRules?: AvatarTransitionRule[]
  /** Deterministic topic tags derived from user messages. */
  topicSignals?: ScenarioTopicSignal[]
  /** Session-scoped avatar availability policy. */
  avatarAvailability?: ScenarioAvatarAvailabilityConfig
  /** Optional high-level routing guidance for director and actor prompts. */
  avatarRoutingPolicy?: Record<string, unknown>
  /** Optional scenario-level specialist role descriptions. */
  specialistRoles?: Record<string, unknown>
}

export interface ScenarioTopicSignal {
  topicId: string
  keywords: string[]
}

export interface ScenarioAvatarAvailabilityConfig {
  initialAvatarKeys?: string[]
  unlockableAvatarKeys?: string[]
}

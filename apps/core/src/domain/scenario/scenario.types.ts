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
  slug: string
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
}

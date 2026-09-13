import type { ScenarioSummary } from '@gami/shared'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'

export function toScenarioSummary(scenario: Scenario): ScenarioSummary {
  return {
    scenarioId: scenario.scenarioId,
    name: scenario.name,
    status: scenario.status,
    ...(scenario.language !== undefined ? { language: scenario.language } : {}),
    objectives: scenario.objectives,
    worldContext: scenario.worldContext,
    avatarAvailability: scenario.avatarAvailability,
    ...(scenario.modelSelection !== undefined ? { modelSelection: scenario.modelSelection } : {}),
    ...(scenario.voiceConfig !== undefined ? { voiceConfig: scenario.voiceConfig } : {}),
    config: scenario.config as Record<string, unknown>,
    createdAt: scenario.createdAt,
    updatedAt: scenario.updatedAt,
  }
}

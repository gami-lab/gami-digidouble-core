import type { ScenarioSummary } from '@gami/shared'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import { readPresentation, withoutPresentation } from '../../../domain/presentation/presentation.js'

export function toScenarioSummary(scenario: Scenario): ScenarioSummary {
  const presentation = readPresentation('scenario', scenario.config)
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
    ...(presentation !== undefined ? { presentation } : {}),
    config: withoutPresentation(scenario.config),
    createdAt: scenario.createdAt,
    updatedAt: scenario.updatedAt,
  }
}

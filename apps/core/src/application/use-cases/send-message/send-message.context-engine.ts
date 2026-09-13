import type { ContextScenarioSnapshot } from '../../../domain/context/session-context.types.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import type { Session } from '../../../domain/conversation/session.types.js'

export function toScenarioSnapshot(session: Session, scenario: Scenario): ContextScenarioSnapshot {
  const goals = [
    ...scenario.objectives,
    ...(Array.isArray(scenario.config.goals) ? scenario.config.goals : []),
  ]
  return {
    scenarioId: session.scenarioId,
    name: scenario.name,
    ...(scenario.language !== undefined ? { language: scenario.language } : {}),
    ...(scenario.worldContext.length > 0 ? { description: scenario.worldContext } : {}),
    ...(goals.length > 0 ? { goals } : {}),
  }
}

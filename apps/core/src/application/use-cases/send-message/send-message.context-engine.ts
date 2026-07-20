import type {
  AvatarContextSections,
  ContextScenarioSnapshot,
} from '../../../domain/context/session-context.types.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import type { Session } from '../../../domain/conversation/session.types.js'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { AvatarPromptIdentitySource } from '../../../domain/avatar/persona-prompt.types.js'

export function toScenarioSnapshot(session: Session, scenario: Scenario): ContextScenarioSnapshot {
  const goals = [
    ...scenario.objectives,
    ...(Array.isArray(scenario.config.goals) ? scenario.config.goals : []),
  ]
  return {
    scenarioId: session.scenarioId,
    name: scenario.name,
    ...(scenario.worldContext.length > 0 ? { description: scenario.worldContext } : {}),
    ...(goals.length > 0 ? { goals } : {}),
  }
}

export function toSelectedPromptIdentitySource(
  avatar: AvatarConfig,
  sections: AvatarContextSections,
): AvatarPromptIdentitySource | null | undefined {
  if (avatar.computedTraits === undefined) return undefined
  if (sections.avatarTraits === undefined) return null

  return {
    source: 'computedTraits',
    computedTraits: sections.avatarTraits,
  }
}

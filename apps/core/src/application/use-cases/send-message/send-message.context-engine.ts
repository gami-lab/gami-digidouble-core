import type { ContextEngineOutput } from '../../../domain/context/context-engine.types.js'
import type { ContextScenarioSnapshot } from '../../../domain/context/session-context.types.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import type { Session } from '../../../domain/conversation/session.types.js'
import type { LayeredMemorySnapshot } from '../../../domain/memory/memory.types.js'

export function toLayeredSnapshotFromAvatarContext(
  assembled: ContextEngineOutput,
): LayeredMemorySnapshot | undefined {
  const conversationState = assembled.avatar.sections.conversationState
  const memory = {
    ...(conversationState.recentExchanges.length > 0
      ? {
          shortTerm: {
            exchangeCount: conversationState.recentExchanges.length,
            recentExchanges: conversationState.recentExchanges,
          },
        }
      : {}),
    ...(conversationState.workingMemory.session !== undefined ||
    conversationState.workingMemory.avatar !== undefined
      ? {
          working: {
            ...(conversationState.workingMemory.session !== undefined
              ? { session: conversationState.workingMemory.session }
              : {}),
            ...(conversationState.workingMemory.avatar !== undefined
              ? { avatar: conversationState.workingMemory.avatar }
              : {}),
          },
        }
      : {}),
    ...(conversationState.longTermFacts.length > 0
      ? { longTerm: { facts: conversationState.longTermFacts } }
      : {}),
  }
  return Object.keys(memory).length > 0 ? memory : undefined
}

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

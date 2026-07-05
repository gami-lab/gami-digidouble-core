import type { ContextEngineOutput } from '../../../domain/context/context-engine.types.js'
import type { ContextScenarioSnapshot } from '../../../domain/context/session-context.types.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import type { Session } from '../../../domain/conversation/session.types.js'
import type { LayeredMemorySnapshot } from '../../../domain/memory/memory.types.js'

export function toLayeredSnapshotFromAvatarContext(
  assembled: ContextEngineOutput,
): LayeredMemorySnapshot | undefined {
  const memory = {
    ...(assembled.avatar.recentExchanges.length > 0
      ? {
          shortTerm: {
            exchangeCount: assembled.avatar.recentExchanges.length,
            recentExchanges: assembled.avatar.recentExchanges,
          },
        }
      : {}),
    ...(assembled.avatar.workingMemory.session !== undefined ||
    assembled.avatar.workingMemory.avatar !== undefined
      ? {
          working: {
            ...(assembled.avatar.workingMemory.session !== undefined
              ? { session: assembled.avatar.workingMemory.session }
              : {}),
            ...(assembled.avatar.workingMemory.avatar !== undefined
              ? { avatar: assembled.avatar.workingMemory.avatar }
              : {}),
          },
        }
      : {}),
    ...(assembled.avatar.longTermFacts.length > 0
      ? { longTerm: { facts: assembled.avatar.longTermFacts } }
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

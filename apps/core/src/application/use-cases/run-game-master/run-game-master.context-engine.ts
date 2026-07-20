import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { GmContextSnapshot } from '../../../domain/context/session-context.types.js'
import type { Session } from '../../../domain/conversation/session.types.js'
import type {
  GameMasterInput,
  GameMasterState,
} from '../../../domain/game-master/game-master.types.js'
import type { TypedRetrievalResult } from '../../../domain/knowledge/knowledge.types.js'
import { toGameMasterAvailableAvatars } from './run-game-master.avatar-unlocks.js'

export function buildGmContextSnapshot(args: {
  session: Session | null
  currentState: GameMasterState
  scenarioAvatars: AvatarConfig[]
  scenarioContext: { description?: string; goals?: string[] }
  recentMessages: Array<{ role: 'user' | 'avatar' | 'system'; content: string }>
  memory: GameMasterInput['context']['memory'] | undefined
  retrieval: TypedRetrievalResult | undefined
  userPersona: GmContextSnapshot['sections']['userPersona']
}): GmContextSnapshot {
  return {
    currentState: args.currentState,
    availableAvatars: toGameMasterAvailableAvatars(args.scenarioAvatars, args.session),
    sections: {
      conversationState: {
        recentMessages: args.recentMessages,
        memory: {
          ...(args.memory?.workingMemory !== undefined
            ? {
                workingMemory: {
                  summary: args.memory.workingMemory.summary,
                  unresolvedThreads: args.memory.workingMemory.unresolvedThreads,
                  coveredTopics: args.memory.workingMemory.coveredTopics,
                },
                workingSummary: args.memory.workingMemory.summary,
              }
            : {}),
          ...(args.memory?.longTermFacts !== undefined
            ? { longTermFacts: args.memory.longTermFacts }
            : {}),
        },
      },
      ...(args.retrieval !== undefined
        ? {
            retrievedContext: {
              memory: args.retrieval.memory,
              world: args.retrieval.world,
              media: args.retrieval.media,
            },
          }
        : {}),
      userPersona: args.userPersona,
      worldContext: {
        scenarioId: args.session?.scenarioId ?? '',
        ...(args.scenarioContext.description !== undefined
          ? { description: args.scenarioContext.description }
          : {}),
        ...(args.scenarioContext.goals !== undefined ? { goals: args.scenarioContext.goals } : {}),
      },
    },
  }
}

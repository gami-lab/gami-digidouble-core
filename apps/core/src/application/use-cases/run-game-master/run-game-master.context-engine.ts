import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { GmContextSnapshot } from '../../../domain/context/session-context.types.js'
import type { Session } from '../../../domain/conversation/session.types.js'
import type { GameMasterState } from '../../../domain/game-master/game-master.types.js'
import type { GameMasterMemoryContext } from '../../../domain/memory/memory.types.js'
import type { TypedRetrievalResult } from '../../../domain/knowledge/knowledge.types.js'
import { toGameMasterAvailableAvatars } from './run-game-master.avatar-unlocks.js'

// eslint-disable-next-line complexity
export function buildGmContextSnapshot(args: {
  session: Session | null
  currentState: GameMasterState
  scenarioAvatars: AvatarConfig[]
  scenarioContext: { language?: string; description?: string; goals?: string[] }
  recentMessages: Array<{ role: 'user' | 'avatar' | 'system'; content: string }>
  memory: GameMasterMemoryContext | undefined
  retrieval: TypedRetrievalResult | undefined
  userPersona: GmContextSnapshot['sections']['userPersona']
}): GmContextSnapshot {
  return {
    currentState: args.currentState,
    availableAvatars: toGameMasterAvailableAvatars(args.scenarioAvatars, args.session),
    sections: {
      conversationState: {
        recentMessages: args.recentMessages,
        recentExchanges: args.memory?.recentExchanges ?? [],
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
        episodicMemories: args.memory?.episodicMemories ?? [],
        longTermFacts: args.memory?.longTermFacts ?? [],
      },
      ...(args.retrieval !== undefined
        ? {
            retrievedContext: {
              avatar_knowledge: args.retrieval.avatar_knowledge,
              world: args.retrieval.world,
              media: args.retrieval.media,
              trace: args.retrieval.trace,
            },
          }
        : {}),
      userPersona: args.userPersona,
      worldContext: {
        scenarioId: args.session?.scenarioId ?? '',
        ...(args.scenarioContext.language !== undefined
          ? { language: args.scenarioContext.language }
          : {}),
        ...(args.scenarioContext.description !== undefined
          ? { description: args.scenarioContext.description }
          : {}),
        ...(args.scenarioContext.goals !== undefined ? { goals: args.scenarioContext.goals } : {}),
      },
    },
  }
}

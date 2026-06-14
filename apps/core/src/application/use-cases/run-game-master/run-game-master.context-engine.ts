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
  userPersona: GmContextSnapshot['userPersona']
}): GmContextSnapshot {
  return {
    recentMessages: args.recentMessages,
    memory: {
      ...(args.memory?.workingMemory !== undefined
        ? { workingSummary: args.memory.workingMemory.summary }
        : {}),
      ...(args.memory?.longTermFacts !== undefined
        ? { longTermFacts: args.memory.longTermFacts }
        : {}),
    },
    ...(args.retrieval !== undefined
      ? {
          knowledge: {
            memory: args.retrieval.memory,
            world: args.retrieval.world,
            media: args.retrieval.media,
          },
        }
      : {}),
    currentState: args.currentState,
    availableAvatars: toGameMasterAvailableAvatars(args.scenarioAvatars, args.session),
    userPersona: args.userPersona,
    scenario: {
      scenarioId: args.session?.scenarioId ?? '',
      ...(args.scenarioContext.description !== undefined
        ? { description: args.scenarioContext.description }
        : {}),
      ...(args.scenarioContext.goals !== undefined ? { goals: args.scenarioContext.goals } : {}),
    },
  }
}

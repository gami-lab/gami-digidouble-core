import type { AvatarComputedTraits } from '../avatar/avatar.types.js'
import type { RetrievedKnowledgeItem } from '../knowledge/knowledge.types.js'
import type {
  ContextMessage,
  GameMasterMemoryContext,
  LongTermMemoryFact,
  ShortTermMemoryExchange,
  AvatarWorkingMemorySummary,
  SessionWorkingMemorySummary,
} from '../memory/memory.types.js'
import type { GameMasterState } from '../game-master/game-master.types.js'
import type { UserPersona } from '../user/user.types.js'
import type { ContextEngineTrace } from './context-engine.types.js'

/**
 * Canonical internal Context Engine snapshot contracts.
 *
 * Ownership:
 * - Internal engine contracts: this file.
 * - API/shared DTOs: packages/shared/src/runtime-inspector-types.ts
 */

export type ContextScenarioSnapshot = {
  scenarioId: string
  name?: string
  description?: string
  goals?: string[]
}

export type ContextAvailableAvatarSnapshot = {
  avatarId: string
  name: string
  description?: string
  scope?: string
  availability?: 'available' | 'locked'
}

export type AvatarContextConversationState = {
  recentExchanges: ShortTermMemoryExchange[]
  workingMemory: {
    session?: SessionWorkingMemorySummary
    avatar?: AvatarWorkingMemorySummary
  }
  longTermFacts: LongTermMemoryFact[]
}

export type AvatarContextRetrievedContext = {
  retrievedItems: RetrievedKnowledgeItem[]
  typedSections?: {
    memory: RetrievedKnowledgeItem[]
    world: RetrievedKnowledgeItem[]
    media: RetrievedKnowledgeItem[]
  }
}

export type AvatarContextSections = {
  directorNotes: string | null
  responseRules: {
    items: string[]
  }
  conversationState: AvatarContextConversationState
  userPersona: UserPersona | null
  worldContext: ContextScenarioSnapshot
  retrievedContext?: AvatarContextRetrievedContext
  avatarTraits?: AvatarComputedTraits
}

export type AvatarContextSnapshot = {
  avatarId?: string
  sections: AvatarContextSections
}

export type GmContextConversationState = {
  recentMessages: ContextMessage[]
  memory: {
    shortTerm?: {
      recentExchanges: ShortTermMemoryExchange[]
    }
    workingMemory?: NonNullable<GameMasterMemoryContext['workingMemory']>
    /** Compatibility mirror of GameMasterMemoryContext.workingMemory.summary only. */
    workingSummary?: string
    longTermFacts?: NonNullable<GameMasterMemoryContext['longTermFacts']>
  }
}

export type GmContextRetrievedContext = {
  memory: RetrievedKnowledgeItem[]
  world: RetrievedKnowledgeItem[]
  media: RetrievedKnowledgeItem[]
}

export type GmContextSections = {
  conversationState: GmContextConversationState
  userPersona: UserPersona | null
  worldContext: ContextScenarioSnapshot
  retrievedContext?: GmContextRetrievedContext
}

export type GmContextSnapshot = {
  currentState: GameMasterState
  availableAvatars: ContextAvailableAvatarSnapshot[]
  sections: GmContextSections
}

export type SessionContextSnapshot = {
  sessionId: string
  avatarContext: AvatarContextSnapshot
  gmContext: GmContextSnapshot
  contextTrace: ContextEngineTrace
}

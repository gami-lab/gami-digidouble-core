import type { RetrievedKnowledgeItem } from '../knowledge/knowledge.types.js'
import type {
  ContextMessage,
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

export type AvatarContextSnapshot = {
  avatarId?: string
  recentExchanges: ShortTermMemoryExchange[]
  workingMemory: {
    session?: SessionWorkingMemorySummary
    avatar?: AvatarWorkingMemorySummary
  }
  longTermFacts: LongTermMemoryFact[]
  knowledge?: {
    retrievedItems: RetrievedKnowledgeItem[]
    typedSections?: {
      memory: RetrievedKnowledgeItem[]
      world: RetrievedKnowledgeItem[]
      media: RetrievedKnowledgeItem[]
    }
  }
  userPersona: UserPersona | null
  gmNotes: string | null
  scenario: ContextScenarioSnapshot
}

export type GmContextSnapshot = {
  recentMessages: ContextMessage[]
  memory: {
    shortTerm?: {
      recentExchanges: ShortTermMemoryExchange[]
    }
    workingSummary?: string
    longTermFacts?: LongTermMemoryFact[]
  }
  knowledge?: {
    memory: RetrievedKnowledgeItem[]
    world: RetrievedKnowledgeItem[]
    media: RetrievedKnowledgeItem[]
  }
  currentState: GameMasterState
  availableAvatars: ContextAvailableAvatarSnapshot[]
  userPersona: UserPersona | null
  scenario: ContextScenarioSnapshot
}

export type SessionContextSnapshot = {
  sessionId: string
  avatarContext: AvatarContextSnapshot
  gmContext: GmContextSnapshot
  contextTrace: ContextEngineTrace
}

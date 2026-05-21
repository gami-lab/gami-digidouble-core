import type { GameMasterState } from '../game-master/game-master.types.js'
import type { TypedRetrievalResult } from '../knowledge/knowledge.types.js'
import type { LayeredMemorySnapshot, ContextMessage } from '../memory/memory.types.js'
import type { UserPersona } from '../user/user.types.js'
import type { ContextSegmentId } from './context-engine.policy.js'
import type {
  ContextScenarioSnapshot,
  GmContextSnapshot,
  AvatarContextSnapshot,
} from './session-context.types.js'

export type ContextEngineInput = {
  sessionId: string
  activeAvatarId?: string
  recentMessages: ContextMessage[]
  scenario: ContextScenarioSnapshot
  availableAvatars: GmContextSnapshot['availableAvatars']
  gmState: GameMasterState
  extensions: {
    memory: LayeredMemorySnapshot | undefined
    retrieval: TypedRetrievalResult | undefined
    retrievalForGm?: TypedRetrievalResult
    userPersona: UserPersona | null
    gmDirective: string | null
  }
}

export type ContextEngineTrace = {
  deterministic: true
  policy: {
    tokenBudget: {
      avatarMaxTokens: number
      gmMaxTokens: number
    }
    protectedSegments: ContextSegmentId[]
    precedence: ContextSegmentId[]
  }
  selectedInputs: {
    hasActiveAvatar: boolean
    recentMessageCount: number
    shortTermExchangeCount: number
    hasWorkingMemory: boolean
    longTermFactCount: number
    retrievalCounts: {
      memory: number
      world: number
      media: number
    }
    visibility?: {
      activeAvatarId?: string
      excludedCounts: {
        memory: number
        world: number
        media: number
      }
      gmRetrievalCounts?: {
        memory: number
        world: number
        media: number
      }
      gmUnrestricted?: true
    }
    hasUserPersona: boolean
    hasGmDirective: boolean
  }
  rationale: {
    avatarProjection: string[]
    gmProjection: string[]
  }
  selection: {
    kept: Array<{
      projection: 'avatar' | 'gm'
      segmentId: ContextSegmentId
      tokenEstimate: number
      reason: 'protected' | 'within_budget'
    }>
    trimmed: Array<{
      projection: 'avatar' | 'gm'
      segmentId: ContextSegmentId
      tokenEstimate: number
      reason: 'budget_exceeded'
    }>
  }
}

export type ContextEngineOutput = {
  avatar: AvatarContextSnapshot
  gm: GmContextSnapshot
  trace: ContextEngineTrace
}

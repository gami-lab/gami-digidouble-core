import type {
  ConversationEndReason,
  SessionMemoryLayers,
  SessionMemorySummary,
} from './lifecycle-types.js'
import type {
  SharedGmWorkingMemory,
  SharedMemoryFactRecord,
  SharedLongTermMemoryFact,
  SharedShortTermMemoryExchange,
  SharedWorkingMemoryAvatarSummary,
  SharedWorkingMemorySessionSummary,
} from './memory-contract-types.js'
import type {
  SharedAvatarContextKnowledgeInjection,
  SharedContextScenarioSnapshot,
  SharedGmContextKnowledgeInjection,
  RecordedAvatarContextKnowledgeInjection,
  RecordedGmContextKnowledgeInjection,
  RecordedKnowledgeReferenceDto,
} from './knowledge-contract-types.js'
import type { ModelProviderName } from './model-catalog.js'
import type { RuntimeState } from './runtime-types.js'
import type { AvatarComputedTraits, SessionSummary } from './entity-types.js'

export type UserPersona = {
  name?: string
  roleInWorld?: string
  avatarRelationships?: string[]
  dialogGuidance?: string
}

export type UserSummary = {
  userId: string
  persona?: UserPersona
  createdAt: string
  updatedAt: string
}

export type UserPersonaResponse = {
  persona: UserPersona | null
}

export type UpsertUserPersonaResponse = {
  user: UserSummary
}

export type GmStateSummary = {
  progression: string
  topicsCovered: string[]
  interactionCount: number
}

export type AdminSessionInspectResponse = {
  inspect: {
    session: SessionSummary
    gmState: GmStateSummary | null
    transitionHistory: Array<{
      fromAvatarId: string | null
      toAvatarId: string
      reason: string | null
      startedBy: 'user' | 'gm' | 'system' | null
      transitionedAt: string
    }>
    unlockedAvatarIds: string[]
    gmNotes: string | null
    effectiveModels: {
      avatar: { provider: string; model: string }
      gameMaster: { provider: string; model: string }
      memory: { provider: string; model: string }
    }
  }
}

export type GmUnlockEvaluation = {
  avatarId: string
  avatarName: string
  reason?: string
  outcome: 'unlocked' | 'already_unlocked' | 'rejected_not_mentioned'
}

export type GmSessionEventPayload = {
  triggerReason: string | null
  turnIndex: number
  interactionCount: number
  stateBefore: Omit<GmStateSummary, 'interactionCount'>
  gmContext?: RecordedGmContextSnapshot
  decision?: {
    dialogueMode: 'user_led' | 'avatar_guided' | 'avatar_led' | 'repair' | 'transition'
    askFollowUp: boolean
    notesInjected: boolean
    injectedNote?: string
    retrievalRequired: boolean
    retrievalPriority?: 'mandatory' | 'optional'
    routingAction?: 'stay' | 'suggest' | 'switch' | 'unlock' | 'unlock_and_switch'
    routingAvatarId?: string
    routingReason?: string
    unlockedAvatarIds?: string[]
    unlockEvaluations?: GmUnlockEvaluation[]
    switchedAvatarId?: string
    progression: 'none' | 'increase'
    objectiveId?: string
  }
  stateAfter?: Omit<GmStateSummary, 'interactionCount'>
  latencyMs: number
  totalLatencyMs?: number
  inputTokens?: number
  outputTokens?: number
  errorCode?: string
  correlationId?: string
}

export type TurnCompletedEventPayload = {
  conversationId: string
  turnIndex: number
  avatarId: string
  avatarContext?: RecordedAvatarContextSnapshot
  avatarLatencyMs: number
  totalTurnLatencyMs: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  model: string
  hasGm: boolean
  retrievalLatencyMs?: number
  otherOverheadMs?: number
  contextSelection?: {
    shortTermExchangeCount: number
    hasWorkingMemory: boolean
    longTermFactCount: number
    retrieval?: {
      selectedForAssemblyCounts: {
        memory: number
        world: number
        media: number
      }
      includedCounts: {
        memory: number
        world: number
        media: number
      }
      omittedByAssemblyCounts?: {
        memory: number
        world: number
        media: number
      }
      excludedByVisibilityCounts?: {
        memory: number
        world: number
        media: number
      }
    }
    hasUserPersona: boolean
    hasGmDirective: boolean
    responseRuleCount: number
    hasAvatarTraits: boolean
  }
  correlationId?: string
}

export type MemoryRefreshEventPayload = {
  sessionId: string
  conversationId: string
  avatarId: string
  trigger: 'post_turn' | 'conversation_closed' | 'avatar_switch' | 'admin_trigger'
  workingSummary?: string
  messageCount?: number
  unresolvedThreads?: string[]
  coveredTopics?: string[]
  candidateFacts?: SharedMemoryFactRecord[]
  exchangeCount?: number
  error?: string
}

export type SessionEventRecord = {
  type:
    | 'gm_triggered'
    | 'gm_error'
    | 'turn_completed'
    | 'memory_refresh_triggered'
    | 'memory_refresh_succeeded'
    | 'memory_refresh_failed'
  correlationId: string
  createdAt: string
  payload: GmSessionEventPayload | TurnCompletedEventPayload | MemoryRefreshEventPayload
}

export type AdminSessionEventsResponse = {
  events: SessionEventRecord[]
}

export type AdminSessionMemoryResponse = {
  session: SessionMemorySummary
}

export type AdminSessionMemoryLayersResponse = {
  session: SessionMemoryLayers
}

export type TurnMetrics = {
  turnIndex: number
  correlationId: string
  conversationId: string
  avatarLatencyMs: number
  totalTurnLatencyMs: number
  overheadMs: number
  retrievalLatencyMs?: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  model: string
  hasGm: boolean
  gmLatencyMs?: number
  gmInputTokens?: number
  gmOutputTokens?: number
}

export type TurnMetricsSummary = {
  totalTurns: number
  turnsWithGm: number
  avgAvatarLatencyMs: number
  avgTotalTurnLatencyMs: number
  avgInputTokens: number
  avgOutputTokens: number
  avgGmLatencyMs: number | null
}

export type AdminSessionTurnMetricsResponse = {
  sessionId: string
  checkedAt: string
  summary: TurnMetricsSummary
  turns: TurnMetrics[]
}

export type RuntimeInspectorSnapshotResponse = {
  snapshot: {
    runtimeState: RuntimeState
    inspect: AdminSessionInspectResponse['inspect']
    memory: SessionMemoryLayers
    events: SessionEventRecord[]
    metrics: AdminSessionTurnMetricsResponse
    persona: UserPersona | null
  }
}

export type ResetSessionAdminActionRequest = {
  sessionId: string
}

export type ResetSessionAdminActionResponse = {
  session: SessionSummary
}

export type EndConversationAdminActionRequest = {
  sessionId: string
  conversationId: string
  reason?: ConversationEndReason
}

export type SessionContextScenarioSnapshot = SharedContextScenarioSnapshot

export type SessionContextAvatarWorkingMemory = {
  session?: SharedWorkingMemorySessionSummary
  avatar?: SharedWorkingMemoryAvatarSummary
}

export type SessionContextRecentMessage = {
  role: 'user' | 'avatar' | 'system'
  content: string
}

export type SessionContextAvailableAvatar = {
  avatarId: string
  name: string
  description?: string
  scope?: string
  availability?: 'available' | 'locked'
}

export type SessionContextGmMemory = {
  shortTerm?: {
    recentExchanges: SharedShortTermMemoryExchange[]
  }
  workingMemory?: SharedGmWorkingMemory
  /** Compatibility mirror of the internal working-memory summary only. */
  workingSummary?: string
  longTermFacts?: SharedLongTermMemoryFact[]
}

export type SessionContextResponseRules = {
  items: string[]
}

export type RecordedResponseRulesSummary = {
  count: number
}

export type RecordedAvatarTraitsSummary = {
  sectionCounts: {
    identity: number
    personality: number
    speakingStyle: number
    background: number
    timeline: number
    currentSituation: number
    behaviouralRules: number
  }
}

type SharedSessionContextAvatarSections<TKnowledge, TResponseRules, TAvatarTraits> = {
  directorNotes: string | null
  responseRules: TResponseRules
  conversationState: {
    recentExchanges: SharedShortTermMemoryExchange[]
    workingMemory: SessionContextAvatarWorkingMemory
    longTermFacts: SharedLongTermMemoryFact[]
  }
  userPersona: UserPersona | null
  worldContext: SessionContextScenarioSnapshot
  retrievedContext?: TKnowledge
  avatarTraits?: TAvatarTraits
}

type SharedSessionContextAvatarSnapshot<TKnowledge, TResponseRules, TAvatarTraits> = {
  avatarId?: string
  sections: SharedSessionContextAvatarSections<TKnowledge, TResponseRules, TAvatarTraits>
}

type SharedSessionContextGmSections<TKnowledge> = {
  conversationState: {
    recentMessages: SessionContextRecentMessage[]
    memory: SessionContextGmMemory
  }
  userPersona: UserPersona | null
  worldContext: SessionContextScenarioSnapshot
  retrievedContext?: TKnowledge
}

type SharedSessionContextGmSnapshot<TKnowledge> = {
  currentState: GmStateSummary
  availableAvatars: SessionContextAvailableAvatar[]
  sections: SharedSessionContextGmSections<TKnowledge>
}

export type SessionContextAvatarSnapshot = SharedSessionContextAvatarSnapshot<
  SharedAvatarContextKnowledgeInjection,
  SessionContextResponseRules,
  AvatarComputedTraits
>

export type SessionContextGmSnapshot =
  SharedSessionContextGmSnapshot<SharedGmContextKnowledgeInjection>

export type RecordedAvatarContextSnapshot = SharedSessionContextAvatarSnapshot<
  RecordedAvatarContextKnowledgeInjection,
  RecordedResponseRulesSummary,
  RecordedAvatarTraitsSummary
>

export type RecordedGmContextSnapshot =
  SharedSessionContextGmSnapshot<RecordedGmContextKnowledgeInjection>

export type RecordedKnowledgeReference = RecordedKnowledgeReferenceDto

export type SessionContextSectionId =
  | 'directorNotes'
  | 'responseRules'
  | 'conversationState'
  | 'userPersona'
  | 'worldContext'
  | 'retrievedContext'
  | 'avatarTraits'

export type SessionContextSegmentId =
  | 'directorNotes'
  | 'responseRules'
  | 'conversationStateWorkingMemory'
  | 'conversationStateLongTermFacts'
  | 'conversationStateRecentExchanges'
  | 'conversationStateRecentMessages'
  | 'userPersona'
  | 'worldContext'
  | 'retrievedContextMemory'
  | 'retrievedContextWorld'
  | 'retrievedContextMedia'
  | 'avatarTraits'

export type SessionContextTrace = {
  deterministic: true
  policy: {
    tokenBudget: {
      avatarMaxTokens: number
      gmMaxTokens: number
    }
    sectionPrecedence: SessionContextSectionId[]
    protectedSegments: SessionContextSegmentId[]
    precedence: SessionContextSegmentId[]
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
    responseRuleCount: number
    hasAvatarTraits: boolean
  }
  rationale: {
    avatarProjection: string[]
    gmProjection: string[]
  }
  selection: {
    kept: Array<{
      projection: 'avatar' | 'gm'
      sectionId: SessionContextSectionId
      segmentId: SessionContextSegmentId
      tokenEstimate: number
      reason: 'protected' | 'within_budget'
    }>
    trimmed: Array<{
      projection: 'avatar' | 'gm'
      sectionId: SessionContextSectionId
      segmentId: SessionContextSegmentId
      tokenEstimate: number
      reason: 'budget_exceeded'
    }>
  }
}

export type AdminSessionContextResponse = {
  sessionId: string
  avatarContext: SessionContextAvatarSnapshot
  gmContext: SessionContextGmSnapshot
  contextTrace: SessionContextTrace
}

export type AdminReplayGmResponse = {
  sessionId: string
  action: 'gm.replay'
  scheduled: true
  correlationId: string
  conversationId: string
  avatarId: string
  turnIndex: number
}

export type AdminRefreshMemoryResponse = {
  sessionId: string
  action: 'memory.refresh'
  scheduled: true
  correlationId: string
  conversationId: string
  avatarId: string
}

export type AdminClearMemoryResponse = {
  sessionId: string
  action: 'memory.clear'
  cleared: {
    sessionWorkingMemory: boolean
    avatarWorkingMemoryCount: number
    gmNotesCleared: boolean
    legacySessionSummaryCleared: boolean
    userFactsCleared: false
  }
}

export type ModelConfigResponse = {
  globalDefault: { provider: ModelProviderName; model: string }
  roleOverrides: {
    avatar?: { provider?: ModelProviderName; model?: string }
    gameMaster?: { provider?: ModelProviderName; model?: string }
    memory?: { provider?: ModelProviderName; model?: string }
  }
  updatedAt: string
}

/** Canonical wire request body for `PUT /v1/admin/model-config`. */
export type UpdateModelConfigRequest = {
  globalDefault: { provider: ModelProviderName; model: string }
  roleOverrides?: {
    avatar?: { provider?: ModelProviderName; model?: string }
    gameMaster?: { provider?: ModelProviderName; model?: string }
    memory?: { provider?: ModelProviderName; model?: string }
  }
}

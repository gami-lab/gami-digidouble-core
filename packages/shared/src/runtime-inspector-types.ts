import type {
  ConversationEndReason,
  SessionMemoryLayers,
  SessionMemorySummary,
} from './lifecycle-types.js'
import type {
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
import type { RuntimeState } from './runtime-types.js'
import type { SessionSummary } from './entity-types.js'

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
  currentAvatarId?: string
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
    avatarId: string
    conversationMode: 'new' | 'continue'
    notesInjected: boolean
    injectedNote?: string
    directiveCount: number
    unlockedAvatarIds?: string[]
    unlockEvaluations?: GmUnlockEvaluation[]
    suggestedAvatarId?: string
    suggestedAvatarReason?: string
    switchedAvatarId?: string
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
  candidateFacts?: Array<{ category: string; key: string; value: string }>
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

export type SessionContextAvatarSnapshot = {
  avatarId?: string
  recentExchanges: SharedShortTermMemoryExchange[]
  workingMemory: {
    session?: SharedWorkingMemorySessionSummary
    avatar?: SharedWorkingMemoryAvatarSummary
  }
  longTermFacts: SharedLongTermMemoryFact[]
  knowledge?: SharedAvatarContextKnowledgeInjection
  userPersona: UserPersona | null
  gmNotes: string | null
  scenario: SessionContextScenarioSnapshot
}

export type SessionContextGmSnapshot = {
  recentMessages: Array<{
    role: 'user' | 'avatar' | 'system'
    content: string
  }>
  memory: {
    shortTerm?: {
      recentExchanges: SharedShortTermMemoryExchange[]
    }
    workingSummary?: string
    longTermFacts?: SharedLongTermMemoryFact[]
  }
  knowledge?: SharedGmContextKnowledgeInjection
  currentState: GmStateSummary
  availableAvatars: Array<{
    avatarId: string
    name: string
    description?: string
    scope?: string
    availability?: 'available' | 'locked'
  }>
  userPersona: UserPersona | null
  scenario: SessionContextScenarioSnapshot
}

export type RecordedAvatarContextSnapshot = {
  avatarId?: string
  recentExchanges: SharedShortTermMemoryExchange[]
  workingMemory: {
    session?: SharedWorkingMemorySessionSummary
    avatar?: SharedWorkingMemoryAvatarSummary
  }
  longTermFacts: SharedLongTermMemoryFact[]
  knowledge?: RecordedAvatarContextKnowledgeInjection
  userPersona: UserPersona | null
  gmNotes: string | null
  scenario: SessionContextScenarioSnapshot
}

export type RecordedGmContextSnapshot = {
  recentMessages: Array<{
    role: 'user' | 'avatar' | 'system'
    content: string
  }>
  memory: {
    shortTerm?: {
      recentExchanges: SharedShortTermMemoryExchange[]
    }
    workingSummary?: string
    longTermFacts?: SharedLongTermMemoryFact[]
  }
  knowledge?: RecordedGmContextKnowledgeInjection
  currentState: GmStateSummary
  availableAvatars: Array<{
    avatarId: string
    name: string
    description?: string
    scope?: string
    availability?: 'available' | 'locked'
  }>
  userPersona: UserPersona | null
  scenario: SessionContextScenarioSnapshot
}

export type RecordedKnowledgeReference = RecordedKnowledgeReferenceDto

export type SessionContextSegmentId =
  | 'gmDirective'
  | 'scenario'
  | 'userPersona'
  | 'shortTermMemory'
  | 'workingMemory'
  | 'longTermFacts'
  | 'typedRetrievalMemory'
  | 'typedRetrievalWorld'
  | 'typedRetrievalMedia'
  | 'recentMessages'

export type SessionContextTrace = {
  deterministic: true
  policy: {
    tokenBudget: {
      avatarMaxTokens: number
      gmMaxTokens: number
    }
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
  }
  rationale: {
    avatarProjection: string[]
    gmProjection: string[]
  }
  selection: {
    kept: Array<{
      projection: 'avatar' | 'gm'
      segmentId: SessionContextSegmentId
      tokenEstimate: number
      reason: 'protected' | 'within_budget'
    }>
    trimmed: Array<{
      projection: 'avatar' | 'gm'
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
  contextTrace?: SessionContextTrace
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
  globalDefault: { provider: string; model: string }
  roleOverrides: {
    avatar?: { provider?: string; model?: string }
    gameMaster?: { provider?: string; model?: string }
    memory?: { provider?: string; model?: string }
  }
  updatedAt: string
}

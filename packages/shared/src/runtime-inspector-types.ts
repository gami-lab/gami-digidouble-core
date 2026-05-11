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
  }
}

export type GmSessionEventPayload = {
  triggerReason: string | null
  turnIndex: number
  interactionCount: number
  stateBefore: Omit<GmStateSummary, 'interactionCount'>
  decision?: {
    avatarId: string
    conversationMode: 'new' | 'continue'
    notesInjected: boolean
    directiveCount: number
    unlockedAvatarIds?: string[]
    suggestedAvatarId?: string
    suggestedAvatarReason?: string
    switchedAvatarId?: string
  }
  stateAfter?: Omit<GmStateSummary, 'interactionCount'>
  latencyMs: number
  inputTokens?: number
  outputTokens?: number
  errorCode?: string
  correlationId?: string
}

export type TurnCompletedEventPayload = {
  conversationId: string
  turnIndex: number
  avatarId: string
  avatarLatencyMs: number
  totalTurnLatencyMs: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  model: string
  hasGm: boolean
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
  avatarLatencyMs: number
  totalTurnLatencyMs: number
  overheadMs: number
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

export type AdminSessionContextResponse = {
  sessionId: string
  avatarContext: SessionContextAvatarSnapshot
  gmContext: SessionContextGmSnapshot
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

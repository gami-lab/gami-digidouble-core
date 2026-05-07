import type {
  ConversationEndReason,
  SessionMemoryLayers,
  SessionMemorySummary,
} from './lifecycle-types.js'
import type { RuntimeState } from './runtime-types.js'
import type { SessionSummary } from './entity-types.js'

export type UserPersona = {
  role?: string
  tonePreference?: string
  interactionHints?: string[]
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

export type SessionEventRecord = {
  type: 'gm_triggered' | 'gm_error' | 'turn_completed'
  correlationId: string
  createdAt: string
  payload: GmSessionEventPayload | TurnCompletedEventPayload
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

export type SessionContextScenarioSnapshot = {
  scenarioId: string
  name?: string
  description?: string
  goals?: string[]
}

export type SessionContextAvatarSnapshot = {
  avatarId?: string
  recentExchanges: Array<{
    user: string
    avatar: string
  }>
  workingMemory: {
    session?: {
      summary: string
      updatedAt: string
    }
    avatar?: {
      avatarId: string
      summary: string
      updatedAt: string
    }
  }
  longTermFacts: Array<{
    category: string
    key: string
    value: string
  }>
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
      recentExchanges: Array<{
        user: string
        avatar: string
      }>
    }
    workingSummary?: string
    longTermFacts?: Array<{
      category: string
      key: string
      value: string
    }>
  }
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

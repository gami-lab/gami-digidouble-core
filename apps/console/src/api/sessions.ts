import { coreRequest } from './client'
import type {
  ConversationSummary,
  LifecycleStatus,
  SessionMemorySummary,
  SessionSummary,
  SessionTransitionRecord,
} from '@gami/shared'

export type { SessionSummary, ConversationSummary, SessionMemorySummary, SessionTransitionRecord }

export type Message = {
  messageId: string
  conversationId: string
  role: 'user' | 'avatar' | 'system'
  content: string
  createdAt: string
  metadata?: {
    model?: string
    latencyMs?: number
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
    costUsd?: number
    triggerSource?: string
  }
}

export type GmStateSummary = {
  currentAvatarId?: string
  progression: string
  topicsCovered: string[]
  interactionCount: number
}

export type InspectSessionResponse = {
  inspect: {
    session: SessionSummary
    gmState: GmStateSummary | null
    transitionHistory: SessionTransitionRecord[]
    unlockedAvatarIds: string[]
    gmNotes: string | null
  }
}

export type SessionEventRecord = {
  type: 'gm_triggered' | 'gm_error'
  correlationId: string
  createdAt: string
  payload: {
    triggerReason: string | null
    turnIndex: number
    interactionCount: number
    stateBefore: {
      currentAvatarId?: string
      progression: string
      topicsCovered: string[]
    }
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
    stateAfter?: {
      currentAvatarId?: string
      progression: string
      topicsCovered: string[]
    }
    latencyMs: number
    inputTokens?: number
    outputTokens?: number
    errorCode?: string
  }
}

export type ListSessionEventsResponse = {
  events: SessionEventRecord[]
}

export type StartSessionParams = {
  userId: string
  scenarioId: string
}

type StartSessionPayload = {
  session: SessionSummary
}

type GetSessionPayload = {
  session: SessionSummary
}

export type GetHistoryResponse = {
  conversation: ConversationSummary
  messages: Message[]
  memory?: SessionMemorySummary
}

export type StartConversationParams = {
  avatarId: string
}

type StartConversationPayload = {
  conversation: ConversationSummary
}

type ListSessionConversationsPayload = {
  conversations: ConversationSummary[]
}

export async function startSession(params: StartSessionParams): Promise<SessionSummary> {
  const payload = await coreRequest<StartSessionPayload>('POST', '/v1/sessions', params)
  return payload.session
}

export async function getSession(sessionId: string): Promise<SessionSummary> {
  const payload = await coreRequest<GetSessionPayload>('GET', `/v1/sessions/${sessionId}`)
  return payload.session
}

export async function startConversation(
  sessionId: string,
  params: StartConversationParams,
): Promise<ConversationSummary> {
  const payload = await coreRequest<StartConversationPayload>(
    'POST',
    `/v1/sessions/${sessionId}/conversations`,
    params,
  )
  return payload.conversation
}

export type AvailableAvatarSummary = {
  avatarId: string
  scenarioId: string
  name: string
  status: string
  personaPrompt: string
  tone?: string
  description?: string
  createdAt: string
  updatedAt: string
}

export type GetAvailableAvatarsResponse = {
  sessionId: string
  currentAvatarId: string | null
  avatars: AvailableAvatarSummary[]
}

export type SwitchAvatarResponse = {
  session: SessionSummary
  conversation: ConversationSummary
  previousConversationId: string | null
}

export async function getAvailableAvatars(sessionId: string): Promise<GetAvailableAvatarsResponse> {
  return coreRequest<GetAvailableAvatarsResponse>(
    'GET',
    `/v1/sessions/${sessionId}/available-avatars`,
  )
}

export async function switchAvatar(
  sessionId: string,
  avatarId: string,
): Promise<SwitchAvatarResponse> {
  return coreRequest<SwitchAvatarResponse>('POST', `/v1/sessions/${sessionId}/switch-avatar`, {
    avatarId,
  })
}

export async function listSessionConversations(sessionId: string): Promise<ConversationSummary[]> {
  const payload = await coreRequest<ListSessionConversationsPayload>(
    'GET',
    `/v1/sessions/${sessionId}/conversations`,
  )
  return payload.conversations
}

export async function getHistory(conversationId: string): Promise<GetHistoryResponse> {
  return coreRequest<GetHistoryResponse>('GET', `/v1/conversations/${conversationId}/history`)
}

export type ListSessionsFilter = {
  scenarioId?: string
  userId?: string
  status?: LifecycleStatus
}

type ListSessionsPayload = {
  sessions: SessionSummary[]
}

type ResetSessionPayload = {
  session: SessionSummary
}

export async function listSessions(filter?: ListSessionsFilter): Promise<SessionSummary[]> {
  const params = new URLSearchParams()
  if (filter?.scenarioId !== undefined) params.set('scenarioId', filter.scenarioId)
  if (filter?.userId !== undefined) params.set('userId', filter.userId)
  if (filter?.status !== undefined) params.set('status', filter.status)
  const query = params.toString()
  const path = query.length > 0 ? `/v1/sessions?${query}` : '/v1/sessions'
  const payload = await coreRequest<ListSessionsPayload>('GET', path)
  return payload.sessions
}

export async function resetSession(sessionId: string): Promise<SessionSummary> {
  const payload = await coreRequest<ResetSessionPayload>('POST', `/v1/sessions/${sessionId}/reset`)
  return payload.session
}

export async function inspectSession(sessionId: string): Promise<InspectSessionResponse> {
  return coreRequest<InspectSessionResponse>('GET', `/v1/admin/sessions/${sessionId}/inspect`)
}

export async function listSessionEvents(
  sessionId: string,
  opts?: { limit?: number },
): Promise<ListSessionEventsResponse> {
  const params = new URLSearchParams()
  if (opts?.limit !== undefined) params.set('limit', String(opts.limit))
  const query = params.toString()
  const path =
    query.length > 0
      ? `/v1/admin/sessions/${sessionId}/events?${query}`
      : `/v1/admin/sessions/${sessionId}/events`
  return coreRequest<ListSessionEventsResponse>('GET', path)
}

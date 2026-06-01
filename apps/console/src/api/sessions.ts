import { coreRequest } from './client'
import type {
  AdminClearMemoryResponse,
  AdminRefreshMemoryResponse,
  AdminReplayGmResponse,
  AdminSessionContextResponse,
  AdminSessionEventsResponse,
  AdminSessionInspectResponse,
  AdminSessionMemoryLayersResponse,
  AdminSessionMemoryResponse,
  AdminSessionTurnMetricsResponse,
  AvailableAvatarSummary,
  ConversationEndReason,
  ConversationSummary,
  EndConversationResponse,
  GetAvailableAvatarsResponse,
  GetHistoryResponse,
  GetRuntimeStateResponse,
  GmStateSummary,
  Message,
  RuntimeState,
  SessionEventRecord,
  SessionMemorySummary,
  SessionSummary,
  SessionTransitionRecord,
  SwitchAvatarResponse,
  UserPersona,
  UpsertUserPersonaResponse,
  UserPersonaResponse,
  EndConversationRequest,
  EndConversationApiResponse,
  GetAvailableAvatarsApiResponse,
  GetSessionResponse,
  ListSessionConversationsResponse,
  ListSessionsQuery,
  ListSessionsResponse,
  ResetSessionResponse,
  StartConversationRequest,
  StartConversationResponse,
  StartSessionRequest,
  StartSessionResponse,
  SwitchAvatarApiResponse,
} from '@gami/shared'

export type { SessionSummary, ConversationSummary, SessionMemorySummary, SessionTransitionRecord }
export type { ConversationEndReason, EndConversationResponse }
export type {
  Message,
  AvailableAvatarSummary,
  GetAvailableAvatarsResponse,
  SwitchAvatarResponse,
  GetHistoryResponse,
}
export type {
  GmStateSummary,
  RuntimeState,
  AdminSessionInspectResponse,
  SessionEventRecord,
  AdminSessionEventsResponse,
  AdminSessionMemoryResponse,
  AdminSessionMemoryLayersResponse,
  AdminSessionTurnMetricsResponse,
  UserPersonaResponse,
  UpsertUserPersonaResponse,
  AdminSessionContextResponse,
  AdminReplayGmResponse,
  AdminRefreshMemoryResponse,
  AdminClearMemoryResponse,
}

export type StartSessionParams = StartSessionRequest
export type StartConversationParams = StartConversationRequest

export async function startSession(params: StartSessionParams): Promise<SessionSummary> {
  const payload = await coreRequest<StartSessionResponse>('POST', '/v1/sessions', params)
  return payload.session
}

export async function getSession(sessionId: string): Promise<SessionSummary> {
  const payload = await coreRequest<GetSessionResponse>('GET', `/v1/sessions/${sessionId}`)
  return payload.session
}

export async function startConversation(
  sessionId: string,
  params: StartConversationParams,
): Promise<ConversationSummary> {
  const payload = await coreRequest<StartConversationResponse>(
    'POST',
    `/v1/sessions/${sessionId}/conversations`,
    params,
  )
  return payload.conversation
}

export async function getAvailableAvatars(sessionId: string): Promise<GetAvailableAvatarsResponse> {
  return coreRequest<GetAvailableAvatarsApiResponse>(
    'GET',
    `/v1/sessions/${sessionId}/available-avatars`,
  )
}

export async function switchAvatar(
  sessionId: string,
  avatarId: string,
): Promise<SwitchAvatarResponse> {
  return coreRequest<SwitchAvatarApiResponse>('POST', `/v1/sessions/${sessionId}/switch-avatar`, {
    avatarId,
  })
}

export async function listSessionConversations(sessionId: string): Promise<ConversationSummary[]> {
  const payload = await coreRequest<ListSessionConversationsResponse>(
    'GET',
    `/v1/sessions/${sessionId}/conversations`,
  )
  return payload.conversations
}

export async function endConversation(
  sessionId: string,
  conversationId: string,
  reason?: ConversationEndReason,
): Promise<EndConversationResponse> {
  const body: EndConversationRequest = reason !== undefined ? { reason } : {}
  return coreRequest<EndConversationApiResponse>(
    'POST',
    `/v1/sessions/${sessionId}/conversations/${conversationId}/end`,
    body,
  )
}

export async function getHistory(conversationId: string): Promise<GetHistoryResponse> {
  return coreRequest<GetHistoryResponse>('GET', `/v1/conversations/${conversationId}/history`)
}

export type ListSessionsFilter = ListSessionsQuery

export async function listSessions(filter?: ListSessionsFilter): Promise<SessionSummary[]> {
  const params = new URLSearchParams()
  if (filter?.scenarioId !== undefined) params.set('scenarioId', filter.scenarioId)
  if (filter?.userId !== undefined) params.set('userId', filter.userId)
  if (filter?.status !== undefined) params.set('status', filter.status)
  const query = params.toString()
  const path = query.length > 0 ? `/v1/sessions?${query}` : '/v1/sessions'
  const payload = await coreRequest<ListSessionsResponse>('GET', path)
  return payload.sessions
}

export async function resetSession(sessionId: string): Promise<SessionSummary> {
  const payload = await coreRequest<ResetSessionResponse>('POST', `/v1/sessions/${sessionId}/reset`)
  return payload.session
}

export async function inspectSession(sessionId: string): Promise<AdminSessionInspectResponse> {
  return coreRequest<AdminSessionInspectResponse>('GET', `/v1/admin/sessions/${sessionId}/inspect`)
}

export async function listSessionEvents(
  sessionId: string,
  opts?: { limit?: number },
): Promise<AdminSessionEventsResponse> {
  const params = new URLSearchParams()
  if (opts?.limit !== undefined) params.set('limit', String(opts.limit))
  const query = params.toString()
  const path =
    query.length > 0
      ? `/v1/admin/sessions/${sessionId}/events?${query}`
      : `/v1/admin/sessions/${sessionId}/events`
  return coreRequest<AdminSessionEventsResponse>('GET', path)
}

export async function getRuntimeState(sessionId: string): Promise<RuntimeState> {
  const payload = await coreRequest<GetRuntimeStateResponse>(
    'GET',
    `/v1/sessions/${sessionId}/runtime-state`,
  )
  return payload.runtimeState
}

export async function getSessionMemory(sessionId: string): Promise<AdminSessionMemoryResponse> {
  return coreRequest<AdminSessionMemoryResponse>('GET', `/v1/admin/sessions/${sessionId}/memory`)
}

export async function getSessionMemoryLayers(
  sessionId: string,
): Promise<AdminSessionMemoryLayersResponse> {
  return coreRequest<AdminSessionMemoryLayersResponse>(
    'GET',
    `/v1/admin/sessions/${sessionId}/memory-layers`,
  )
}

export async function getSessionMetrics(
  sessionId: string,
): Promise<AdminSessionTurnMetricsResponse> {
  return coreRequest<AdminSessionTurnMetricsResponse>(
    'GET',
    `/v1/admin/sessions/${sessionId}/metrics`,
  )
}

export async function getUserPersona(userId: string): Promise<UserPersonaResponse> {
  return coreRequest<UserPersonaResponse>('GET', `/v1/users/${userId}/persona`)
}

export async function upsertUserPersona(
  userId: string,
  persona: UserPersona,
): Promise<UpsertUserPersonaResponse> {
  return coreRequest<UpsertUserPersonaResponse>('PUT', `/v1/users/${userId}/persona`, persona)
}

export async function getSessionContext(sessionId: string): Promise<AdminSessionContextResponse> {
  return coreRequest<AdminSessionContextResponse>('GET', `/v1/admin/sessions/${sessionId}/context`)
}

export async function replayGm(sessionId: string): Promise<AdminReplayGmResponse> {
  return coreRequest<AdminReplayGmResponse>('POST', `/v1/admin/sessions/${sessionId}/gm/replay`)
}

export async function refreshSessionMemory(sessionId: string): Promise<AdminRefreshMemoryResponse> {
  return coreRequest<AdminRefreshMemoryResponse>(
    'POST',
    `/v1/admin/sessions/${sessionId}/memory/refresh`,
  )
}

export async function clearSessionMemory(sessionId: string): Promise<AdminClearMemoryResponse> {
  return coreRequest<AdminClearMemoryResponse>(
    'POST',
    `/v1/admin/sessions/${sessionId}/memory/clear`,
  )
}

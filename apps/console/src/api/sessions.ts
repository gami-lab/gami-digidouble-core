import { coreRequest } from './client'
import type {
  AdminClearMemoryResponse,
  AdminRefreshMemoryResponse,
  AdminReplayGmResponse,
  AdminSessionContextResponse,
  AdminSessionEventsResponse,
  AdminSessionInspectResponse,
  AdminSessionMemoryLayersResponse,
  ConversationSummary,
  GetAvailableAvatarsApiResponse,
  GetAvailableAvatarsResponse,
  GetHistoryResponse,
  ListSessionConversationsResponse,
  ListSessionsResponse,
  ResetSessionResponse,
  SendMessageApiResponse,
  SessionSummary,
  StartConversationResponse,
  StartSessionResponse,
} from '@gami/shared'

/** The events endpoint returns the newest events first, at most this many. */
export const SESSION_EVENTS_LIMIT = 200

export async function listSessions(scenarioId: string): Promise<SessionSummary[]> {
  const payload = await coreRequest<ListSessionsResponse>(
    'GET',
    `/v1/sessions?scenarioId=${encodeURIComponent(scenarioId)}`,
  )
  return payload.sessions
}

export async function startSession(userId: string, scenarioId: string): Promise<SessionSummary> {
  const payload = await coreRequest<StartSessionResponse>('POST', '/v1/sessions', {
    userId,
    scenarioId,
  })
  return payload.session
}

export async function resetSession(sessionId: string): Promise<SessionSummary> {
  const payload = await coreRequest<ResetSessionResponse>('POST', `/v1/sessions/${sessionId}/reset`)
  return payload.session
}

export async function listSessionConversations(sessionId: string): Promise<ConversationSummary[]> {
  const payload = await coreRequest<ListSessionConversationsResponse>(
    'GET',
    `/v1/sessions/${sessionId}/conversations`,
  )
  return payload.conversations
}

export async function getAvailableAvatars(sessionId: string): Promise<GetAvailableAvatarsResponse> {
  return coreRequest<GetAvailableAvatarsApiResponse>(
    'GET',
    `/v1/sessions/${sessionId}/available-avatars`,
  )
}

export async function startConversation(
  sessionId: string,
  avatarId: string,
): Promise<ConversationSummary> {
  const payload = await coreRequest<StartConversationResponse>(
    'POST',
    `/v1/sessions/${sessionId}/conversations`,
    { avatarId },
  )
  return payload.conversation
}

export async function getHistory(conversationId: string): Promise<GetHistoryResponse> {
  return coreRequest<GetHistoryResponse>('GET', `/v1/conversations/${conversationId}/history`)
}

export async function sendMessage(
  conversationId: string,
  content: string,
): Promise<SendMessageApiResponse> {
  return coreRequest<SendMessageApiResponse>(
    'POST',
    `/v1/conversations/${conversationId}/messages`,
    { message: { content } },
  )
}

export async function inspectSession(sessionId: string): Promise<AdminSessionInspectResponse> {
  return coreRequest<AdminSessionInspectResponse>('GET', `/v1/admin/sessions/${sessionId}/inspect`)
}

export async function listSessionEvents(sessionId: string): Promise<AdminSessionEventsResponse> {
  return coreRequest<AdminSessionEventsResponse>(
    'GET',
    `/v1/admin/sessions/${sessionId}/events?limit=${String(SESSION_EVENTS_LIMIT)}`,
  )
}

export async function getSessionMemoryLayers(
  sessionId: string,
): Promise<AdminSessionMemoryLayersResponse> {
  return coreRequest<AdminSessionMemoryLayersResponse>(
    'GET',
    `/v1/admin/sessions/${sessionId}/memory-layers`,
  )
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

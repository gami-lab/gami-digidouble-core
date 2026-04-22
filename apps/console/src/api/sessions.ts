import { coreRequest } from './client'

export type SessionSummary = {
  sessionId: string
  userId: string
  scenarioId: string
  activeAvatarId?: string | null
  availableAvatarIds?: string[]
  status: 'active' | 'closed' | 'archived'
  startedAt: string
  lastActivityAt: string
  endedAt?: string | null
}

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

export type SessionMemorySummary = {
  sessionId: string
  summary: string
  updatedAt: string
}

export type ConversationSummary = {
  conversationId: string
  sessionId: string
  avatarId: string
  status: 'active' | 'closed' | 'archived'
  startedAt: string
  lastActivityAt: string
  endedAt?: string | null
}

export type StartSessionParams = {
  userId: string
  scenarioId: string
}

type StartSessionPayload = {
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

export async function startSession(params: StartSessionParams): Promise<SessionSummary> {
  const payload = await coreRequest<StartSessionPayload>('POST', '/v1/sessions', params)
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

export async function getHistory(conversationId: string): Promise<GetHistoryResponse> {
  return coreRequest<GetHistoryResponse>('GET', `/v1/conversations/${conversationId}/history`)
}

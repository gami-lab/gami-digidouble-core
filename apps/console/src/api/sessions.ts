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
  sessionId: string
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

export type StartSessionParams = {
  userId: string
  scenarioId: string
}

type StartSessionPayload = {
  session: SessionSummary
}

export type GetHistoryResponse = {
  session: SessionSummary
  messages: Message[]
  memory?: SessionMemorySummary
}

export type ResetSessionResponse = {
  sessionId: string
  deleted: {
    messages: number
    sessionMemory: boolean
    events: number
  }
}

export async function startSession(params: StartSessionParams): Promise<SessionSummary> {
  const payload = await coreRequest<StartSessionPayload>('POST', '/v1/conversations/start', params)
  return payload.session
}

export async function getHistory(sessionId: string): Promise<GetHistoryResponse> {
  return coreRequest<GetHistoryResponse>('GET', `/v1/conversations/${sessionId}/history`)
}

export async function resetSession(sessionId: string): Promise<ResetSessionResponse> {
  return coreRequest<ResetSessionResponse>('DELETE', `/v1/conversations/${sessionId}`)
}

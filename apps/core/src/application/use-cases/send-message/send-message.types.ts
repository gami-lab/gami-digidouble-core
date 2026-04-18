import type { Session } from '../../../domain/conversation/session.types.js'

export interface SendMessageInput {
  sessionId: string
  avatarId: string
  userMessage: string
}

export type SendMessageSessionSummary = Pick<
  Session,
  'sessionId' | 'userId' | 'scenarioId' | 'status' | 'startedAt' | 'lastActivityAt'
>

export interface SendMessageOutput {
  requestId: string
  sessionId: string
  session: SendMessageSessionSummary
  userMessage: {
    messageId: string
    content: string
    createdAt: string
  }
  avatarMessage: {
    messageId: string
    content: string
    createdAt: string
    model: string
    inputTokens: number
    outputTokens: number
    latencyMs: number
  }
}

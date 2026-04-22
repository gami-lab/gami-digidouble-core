import type { Conversation, Session } from '../../../domain/conversation/session.types.js'

export interface SendMessageInput {
  conversationId: string
  userMessage: string
}

export type SendMessageSessionSummary = Pick<
  Session,
  | 'sessionId'
  | 'userId'
  | 'scenarioId'
  | 'activeAvatarId'
  | 'status'
  | 'startedAt'
  | 'lastActivityAt'
>

export interface SendMessageOutput {
  requestId: string
  conversationId: string
  conversation: Pick<
    Conversation,
    | 'conversationId'
    | 'sessionId'
    | 'avatarId'
    | 'status'
    | 'startedAt'
    | 'lastActivityAt'
    | 'endedAt'
  >
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

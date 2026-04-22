import type { Conversation } from '../../../domain/conversation/session.types.js'

export interface ListSessionConversationsInput {
  sessionId: string
}

export type ConversationSummary = Pick<
  Conversation,
  | 'conversationId'
  | 'sessionId'
  | 'avatarId'
  | 'status'
  | 'startedAt'
  | 'lastActivityAt'
  | 'endedAt'
>

export interface ListSessionConversationsOutput {
  conversations: ConversationSummary[]
}

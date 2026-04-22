import type { Conversation } from '../../../domain/conversation/session.types.js'

export interface StartConversationInput {
  sessionId: string
  avatarId: string
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

export interface StartConversationOutput {
  conversation: ConversationSummary
}

import type { Conversation, Session } from '../../../domain/conversation/session.types.js'

export interface SwitchAvatarInput {
  sessionId: string
  avatarId: string
  reason?: string
}

export type SessionSummary = Pick<
  Session,
  | 'sessionId'
  | 'userId'
  | 'scenarioId'
  | 'activeAvatarId'
  | 'status'
  | 'startedAt'
  | 'lastActivityAt'
  | 'endedAt'
>

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

export interface SwitchAvatarOutput {
  session: SessionSummary
  conversation: ConversationSummary
  previousConversationId: string | null
}

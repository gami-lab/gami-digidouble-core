import type { ConversationSummary, SessionSummary } from '@gami/shared'

export interface SwitchAvatarInput {
  sessionId: string
  avatarId: string
  reason?: string
}

export type { SessionSummary, ConversationSummary }

export interface SwitchAvatarOutput {
  session: SessionSummary
  conversation: ConversationSummary
  previousConversationId: string | null
}

import type { ConversationSummary } from '@gami/shared'

export interface StartConversationInput {
  sessionId: string
  avatarId: string
}

export type { ConversationSummary }

export interface StartConversationOutput {
  conversation: ConversationSummary
}

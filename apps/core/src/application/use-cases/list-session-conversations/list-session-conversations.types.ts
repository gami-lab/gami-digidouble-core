import type { ConversationSummary } from '@gami/shared'

export interface ListSessionConversationsInput {
  sessionId: string
}

export type { ConversationSummary }

export interface ListSessionConversationsOutput {
  conversations: ConversationSummary[]
}

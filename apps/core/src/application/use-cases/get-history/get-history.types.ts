import type { ConversationSummary, Message } from '@gami/shared'

export interface GetHistoryInput {
  conversationId: string
}

export type { ConversationSummary }

export interface GetHistoryOutput {
  conversation: ConversationSummary
  messages: Message[]
}

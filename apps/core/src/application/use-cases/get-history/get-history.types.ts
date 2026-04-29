import type { ConversationSummary } from '@gami/shared'
import type { Message } from '../../../domain/conversation/session.types.js'

export interface GetHistoryInput {
  conversationId: string
}

export type { ConversationSummary }

export interface GetHistoryOutput {
  conversation: ConversationSummary
  messages: Message[]
}

import type { ConversationEndReason, EndConversationResponse } from '@gami/shared'

export interface EndConversationInput {
  sessionId: string
  conversationId: string
  reason?: ConversationEndReason
}

export type { EndConversationResponse, ConversationEndReason }

import type { ConversationSummary, ModelSelectionOverride, SessionSummary } from '@gami/shared'
import type { Conversation, Session } from '../../../domain/conversation/session.types.js'

// Ownership: these are backend execution contracts. Public HTTP and stream
// DTOs remain in packages/shared and are mapped at the API boundary.

export interface SendMessageInput {
  conversationId: string
  userMessage: string
  model?: ModelSelectionOverride
}

export type { SessionSummary, ConversationSummary }

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
  session: Pick<
    Session,
    | 'sessionId'
    | 'userId'
    | 'scenarioId'
    | 'activeAvatarId'
    | 'unlockedAvatarIds'
    | 'status'
    | 'startedAt'
    | 'lastActivityAt'
  >
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

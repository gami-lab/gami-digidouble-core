import type { AvatarSummary, ConversationSummary, SessionSummary } from './entity-types.js'
import type { SessionMemorySummary } from './lifecycle-types.js'
import type { LlmResponseMetrics } from './llm-contract-types.js'
export type { LlmResponseMetrics } from './llm-contract-types.js'

export type MessageMetadata = {
  model?: string
  latencyMs?: number
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  costUsd?: number
  triggerSource?: string
}

export type Message = {
  messageId: string
  conversationId: string
  role: 'user' | 'avatar' | 'system'
  content: string
  createdAt: string
  metadata?: MessageMetadata
}

export type AvatarMessageMetadata = LlmResponseMetrics &
  Pick<MessageMetadata, 'totalTokens' | 'costUsd' | 'triggerSource'>

export type SendMessageResponse = {
  conversation: ConversationSummary
  session: SessionSummary
  userMessage: Message
  avatarMessage: Message & {
    metadata: AvatarMessageMetadata
  }
  debug: { requestId: string } & LlmResponseMetrics
}

export type GetHistoryResponse = {
  conversation: ConversationSummary
  messages: Message[]
  memory?: SessionMemorySummary
}

/**
 * Player-facing avatar summary for the "available avatars" endpoint.
 *
 * Deliberately narrower than the canonical `AvatarSummary`: it omits `config` (may hold
 * GM-only scenario data) and `llmOverride` (internal routing detail). Derived via `Pick`
 * from the canonical type so new AvatarSummary fields must be explicitly opted in here.
 */
export type AvailableAvatarSummary = Pick<
  AvatarSummary,
  | 'avatarId'
  | 'scenarioId'
  | 'name'
  | 'status'
  | 'personaPrompt'
  | 'tone'
  | 'description'
  | 'adjustments'
  | 'createdAt'
  | 'updatedAt'
>

export type GetAvailableAvatarsResponse = {
  sessionId: string
  currentAvatarId: string | null
  avatars: AvailableAvatarSummary[]
}

export type SwitchAvatarResponse = {
  session: SessionSummary
  conversation: ConversationSummary
  previousConversationId: string | null
}

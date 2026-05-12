import type { ConversationSummary, SessionSummary } from './entity-types.js'
import type { SessionMemorySummary } from './lifecycle-types.js'

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

export type AvatarMessageMetadata = {
  model: string
  latencyMs: number
  inputTokens: number
  outputTokens: number
  totalTokens?: number
  costUsd?: number
  triggerSource?: string
}

export type SendMessageResponse = {
  conversation: ConversationSummary
  session: SessionSummary
  userMessage: Message
  avatarMessage: Message & {
    metadata: AvatarMessageMetadata
  }
  debug: {
    requestId: string
    model: string
    latencyMs: number
    inputTokens: number
    outputTokens: number
  }
}

export type GetHistoryResponse = {
  conversation: ConversationSummary
  messages: Message[]
  memory?: SessionMemorySummary
}

export type AvailableAvatarSummary = {
  avatarId: string
  scenarioId: string
  name: string
  status: 'draft' | 'active' | 'archived'
  personaPrompt: string
  tone?: string
  description?: string
  adjustments?: string[]
  createdAt: string
  updatedAt: string
}

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

import type { AvatarRequestOptions } from '@gami/shared'

/** Runtime session — owns the lifecycle of one conversation. */
export interface Session {
  sessionId: string
  userId: string
  scenarioId: string
  activeAvatarId?: string
  unlockedAvatarIds?: string[]
  gmNotes?: string
  memorySummary?: string
  status: 'active' | 'closed' | 'archived'
  avatarOptions?: AvatarRequestOptions
  startedAt: string
  lastActivityAt: string
  endedAt?: string
}

/** One bounded dialogue episode with one avatar inside a session. */
export interface Conversation {
  conversationId: string
  sessionId: string
  avatarId: string
  status: 'active' | 'closed' | 'archived'
  startedAt: string
  lastActivityAt: string
  endedAt?: string
  startedBy?: 'user' | 'gm' | 'system'
  reason?: string
  handoffFromConversationId?: string
}

/** A single message in a conversation. */
export interface Message {
  messageId: string
  conversationId: string
  role: 'user' | 'avatar' | 'system'
  content: string
  createdAt: string
  metadata?: MessageMetadata
}

/** Observability metadata attached to avatar-generated messages. */
export interface MessageMetadata {
  model?: string
  latencyMs?: number
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  costUsd?: number
  triggerSource?: string
}

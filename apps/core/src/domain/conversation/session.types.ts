/** Runtime session — owns the lifecycle of one conversation. */
export interface Session {
  sessionId: string
  userId: string
  scenarioId: string
  status: 'active' | 'closed' | 'archived'
  startedAt: string
  lastActivityAt: string
  endedAt?: string | null
}

/** A single message in a conversation. */
export interface Message {
  messageId: string
  sessionId: string
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

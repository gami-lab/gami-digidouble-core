import type { LifecycleStatus } from './entity-types.js'

export type ConversationStartedBy = 'user' | 'gm' | 'system'

export type SessionMemorySummary = {
  sessionId: string
  summary: string
  updatedAt: string
}

export type SessionTransitionRecord = {
  fromAvatarId: string | null
  toAvatarId: string
  reason: string | null
  startedBy: ConversationStartedBy | null
  transitionedAt: string
}

export type AvatarTransitionRecord = {
  toConversationId: string
  toAvatarId: string
  fromConversationId: string | null
  fromAvatarId: string | null
  reason: string | null
  startedBy: ConversationStartedBy | null
  transitionedAt: string
}

export type LifecycleSummary = {
  status: LifecycleStatus
  endedAt?: string
}

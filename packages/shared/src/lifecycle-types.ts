import type { LifecycleStatus } from './entity-types.js'

export type ConversationStartedBy = 'user' | 'gm' | 'system'
export type ConversationEndReason =
  | 'user_end'
  | 'operator_end'
  | 'scenario_complete'
  | 'safety_stop'
  | 'inactivity_timeout'
  | 'auto_terminal_signal'

export type SessionMemorySummary = {
  sessionId: string
  summary: string
  shortTerm?: {
    exchangeCount: 2
  }
  longTermFactCount?: number
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

export type EndConversationResponse = {
  conversation: {
    conversationId: string
    sessionId: string
    avatarId: string
    status: LifecycleStatus
    startedAt: string
    lastActivityAt: string
    endedAt?: string
  }
  compaction: {
    scheduled: true
  }
}

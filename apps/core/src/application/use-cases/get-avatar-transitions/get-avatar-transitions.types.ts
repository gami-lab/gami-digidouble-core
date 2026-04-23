import type { Conversation } from '../../../domain/conversation/session.types.js'

export interface GetAvatarTransitionsInput {
  sessionId: string
}

export type AvatarTransitionRecord = {
  toConversationId: string
  toAvatarId: string
  fromConversationId: string | null
  fromAvatarId: string | null
  reason: string | null
  startedBy: Conversation['startedBy'] | null
  transitionedAt: string
}

export interface GetAvatarTransitionsOutput {
  sessionId: string
  transitions: AvatarTransitionRecord[]
}

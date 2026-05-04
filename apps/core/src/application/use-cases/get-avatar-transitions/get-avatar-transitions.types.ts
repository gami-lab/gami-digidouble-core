import type { AvatarTransitionRecord } from '@gami/shared'

export type { AvatarTransitionRecord }

export interface GetAvatarTransitionsInput {
  sessionId: string
}

export interface GetAvatarTransitionsOutput {
  sessionId: string
  transitions: AvatarTransitionRecord[]
}

import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'

export interface GetAvailableAvatarsInput {
  sessionId: string
}

export type AvatarSummary = Pick<
  AvatarConfig,
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

export interface GetAvailableAvatarsOutput {
  sessionId: string
  currentAvatarId: string | null
  avatars: AvatarSummary[]
}

import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'

export type UpdateAvatarInput = {
  avatarId: string
  name?: string
  personaPrompt?: string
  tone?: string
  description?: string
  adjustments?: string[]
  config?: Record<string, unknown>
  status?: AvatarConfig['status']
}

export type UpdateAvatarOutput = {
  avatar: AvatarConfig
}

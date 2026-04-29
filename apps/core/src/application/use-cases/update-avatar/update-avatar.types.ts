import type { AvatarSummary } from '@gami/shared'

export type UpdateAvatarInput = {
  avatarId: string
  name?: string
  personaPrompt?: string
  tone?: string
  description?: string
  adjustments?: string[]
  config?: Record<string, unknown>
  status?: AvatarSummary['status']
  availabilityKey?: string
}

export type UpdateAvatarOutput = {
  avatar: AvatarSummary
}

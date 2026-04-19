import type { AvatarStatus } from '../../../domain/avatar/avatar.types.js'

export interface CreateAvatarInput {
  scenarioId: string
  name: string
  slug: string
  personaPrompt: string
  tone?: string
  description?: string
  adjustments?: string[]
  config?: Record<string, unknown>
  status?: AvatarStatus
}

export interface CreateAvatarOutput {
  avatar: {
    avatarId: string
    scenarioId: string
    name: string
    slug: string
    status: AvatarStatus
    personaPrompt: string
    tone?: string
    description?: string
    adjustments?: string[]
    createdAt: string
    updatedAt: string
  }
}

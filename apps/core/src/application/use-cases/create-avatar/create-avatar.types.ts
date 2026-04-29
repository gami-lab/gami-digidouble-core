import type { AvatarSummary } from '@gami/shared'

export interface CreateAvatarInput {
  scenarioId: string
  name: string
  personaPrompt: string
  tone?: string
  description?: string
  adjustments?: string[]
  config?: Record<string, unknown>
  status?: AvatarSummary['status']
  availabilityKey?: string
}

export interface CreateAvatarOutput {
  avatar: AvatarSummary
}

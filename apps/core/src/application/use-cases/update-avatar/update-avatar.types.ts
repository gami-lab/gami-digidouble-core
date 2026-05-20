import type { AvatarSummary } from '@gami/shared'
import type { AvatarLlmOverride } from '../../../domain/model-config/index.js'

export type UpdateAvatarInput = {
  avatarId: string
  name?: string
  personaPrompt?: string
  tone?: string
  description?: string
  adjustments?: string[]
  llmOverride?: AvatarLlmOverride | null
  config?: Record<string, unknown>
  status?: AvatarSummary['status']
}

export type UpdateAvatarOutput = {
  avatar: AvatarSummary
}

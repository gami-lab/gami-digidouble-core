import type { AvatarSummary } from '@gami/shared'
import type { AvatarLlmOverride } from '../../../domain/model-config/index.js'

export interface CreateAvatarInput {
  scenarioId: string
  name: string
  personaPrompt: string
  tone?: string
  description?: string
  adjustments?: string[]
  llmOverride?: AvatarLlmOverride | null
  config?: Record<string, unknown>
  status?: AvatarSummary['status']
}

export interface CreateAvatarOutput {
  avatar: AvatarSummary
}

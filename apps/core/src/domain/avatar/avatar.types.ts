// Canonical trait schema — imported (not re-declared) so this domain module
// stays in sync with the shared HTTP contract automatically.
import type { AvatarComputedTraits, VoiceConfiguration } from '@gami/shared'
import type { AvatarLlmOverride } from '../model-config/index.js'
import { DomainError } from '../errors.js'

export type { AvatarComputedTraits }

export type AvatarStatus = 'draft' | 'active' | 'archived'

export interface Avatar {
  id: string
  scenarioId: string
  name: string
  status: AvatarStatus
  personaPrompt: string
  tone?: string
  description?: string
  computedTraits?: AvatarComputedTraits
  config: Record<string, unknown>
  /** Provider-neutral voice configuration projected from the reserved config section. */
  voiceConfig?: VoiceConfiguration
  createdAt: string
  updatedAt: string
}

/**
 * Runtime avatar configuration used by application/domain prompt assembly.
 * This is a subset of Avatar focused on fields required at runtime.
 */
export interface AvatarConfig {
  avatarId: string
  scenarioId: string
  name: string
  status: AvatarStatus
  personaPrompt: string
  tone?: string
  description?: string
  /** Ordered list of persona style adjustments appended to the assembled system prompt. */
  adjustments?: string[]
  /** Optional per-avatar model override sourced from config.llmOverride JSONB. */
  llmOverride?: AvatarLlmOverride
  /** Derived trait structure; undefined until preparation has run. */
  computedTraits?: AvatarComputedTraits
  config: Record<string, unknown>
  /** Provider-neutral voice configuration projected from the reserved config section. */
  voiceConfig?: VoiceConfiguration
  createdAt: string
  updatedAt: string
}

export function requirePreparedAvatar(avatar: AvatarConfig): AvatarConfig & {
  computedTraits: AvatarComputedTraits
} {
  if (avatar.status !== 'active') {
    throw new DomainError('CONFLICT', `Avatar ${avatar.avatarId} is not active.`)
  }
  if (avatar.computedTraits === undefined) {
    throw new DomainError('CONFLICT', `Avatar ${avatar.avatarId} has not been prepared.`)
  }
  return avatar as AvatarConfig & { computedTraits: AvatarComputedTraits }
}

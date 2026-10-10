/**
 * Canonical entity summary types shared across apps.
 *
 * These are the read/response shapes returned by the Core API.
 * They are the single source of truth for all consumers (apps/core routes, apps/console client).
 *
 * Rules:
 * - These types represent what the API sends over the wire — they are output shapes.
 * - Input/mutation types (create, update payloads) stay server-internal in the application layer.
 * - Optional fields remain optional; nullable fields from the API use `string | null` only when
 *   the API contract explicitly sends `null` (not undefined).
 */

import type { ModelSelectionOverride, ScenarioModelSelection } from './model-catalog.js'
import type { AvatarRequestOptions } from './web-contract-types.js'
import type { VoiceConfiguration, VoiceConfigurationUpdate } from './voice-contract-types.js'
export type { ScenarioModelSelection } from './model-catalog.js'

export type AvatarStatus = 'draft' | 'active' | 'archived'

export type AvatarLlmOverride = ModelSelectionOverride

type AvatarAuthoredFields = {
  name: string
  personaPrompt: string
  tone?: string
  description?: string
  adjustments?: string[]
}

type AvatarMutationOptionalFields = {
  llmOverride?: AvatarLlmOverride | null
  voiceConfig?: VoiceConfiguration
  config?: Record<string, unknown>
  status?: AvatarStatus
}

/**
 * Derived trait structure computed from an avatar's source material
 * (author input, memory documents, world context).
 *
 * The seven field names are shared by trait preparation and Avatar Prompt Assembly.
 */
export type AvatarComputedTraits = {
  identity: string[]
  personality: string[]
  speakingStyle: string[]
  background: string[]
  timeline: string[]
  currentSituation: string[]
  behaviouralRules: string[]
}

export type AvatarSummary = AvatarAuthoredFields & {
  avatarId: string
  scenarioId: string
  status: AvatarStatus
  llmOverride?: AvatarLlmOverride
  voiceConfig?: VoiceConfiguration
  /** Stable public route key when present in avatar config. */
  availabilityKey?: string
  /** Derived trait structure is present once the Avatar is servable. */
  computedTraits?: AvatarComputedTraits
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type CreateAvatarRequest = Pick<AvatarAuthoredFields, 'name' | 'personaPrompt'> &
  Pick<AvatarAuthoredFields, 'tone' | 'description' | 'adjustments'> &
  AvatarMutationOptionalFields

export type UpdateAvatarRequest = Omit<Partial<CreateAvatarRequest>, 'voiceConfig'> & {
  voiceConfig?: VoiceConfigurationUpdate
}

export type ScenarioStatus = 'draft' | 'active' | 'archived'

export type LifecycleStatus = 'active' | 'closed' | 'archived'

export type ScenarioAvatarAvailability = {
  initialAvatarIds: string[]
  unlockableAvatarIds?: string[]
}

export type ScenarioSummary = {
  scenarioId: string
  name: string
  status: ScenarioStatus
  /** Canonical language used by Avatar text, speech recognition, and synthesis. */
  language?: string
  objectives: string[]
  worldContext: string
  avatarAvailability: ScenarioAvatarAvailability
  modelSelection?: ScenarioModelSelection
  voiceConfig?: VoiceConfiguration
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type SessionSummary = {
  sessionId: string
  userId: string
  scenarioId: string
  activeAvatarId?: string
  unlockedAvatarIds: string[]
  status: LifecycleStatus
  avatarOptions?: AvatarRequestOptions
  startedAt: string
  lastActivityAt: string
  endedAt?: string
}

export type ConversationSummary = {
  conversationId: string
  sessionId: string
  avatarId: string
  status: LifecycleStatus
  startedAt: string
  lastActivityAt: string
  endedAt?: string
}

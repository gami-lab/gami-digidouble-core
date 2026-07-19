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
export type { ScenarioModelSelection } from './model-catalog.js'

/** Avatar status union — matches domain AvatarStatus. */
export type AvatarStatus = 'draft' | 'active' | 'archived'

export type AvatarLlmOverride = ModelSelectionOverride

/**
 * Fixed, derived trait structure computed from an avatar's source material
 * (author input, memory documents, world context) — see EPIC 8.1.
 *
 * The seven field names are stable: they are reused by the trait generation
 * prompt and by Avatar Prompt Assembly (EPIC 8.2). Do not rename or add
 * fields without updating both.
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

/** Canonical read shape for an Avatar as returned by the Core API. */
export type AvatarSummary = {
  avatarId: string
  scenarioId: string
  name: string
  status: AvatarStatus
  personaPrompt: string
  tone?: string
  description?: string
  adjustments?: string[]
  llmOverride?: AvatarLlmOverride
  /** Derived trait structure, or `null` if preparation has not run yet (EPIC 8.1). */
  computedTraits: AvatarComputedTraits | null
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type CreateAvatarRequest = {
  name: string
  personaPrompt: string
  tone?: string
  description?: string
  adjustments?: string[]
  llmOverride?: AvatarLlmOverride | null
  config?: Record<string, unknown>
  status?: AvatarStatus
}

export type UpdateAvatarRequest = {
  name?: string
  personaPrompt?: string
  tone?: string
  description?: string
  adjustments?: string[]
  llmOverride?: AvatarLlmOverride | null
  config?: Record<string, unknown>
  status?: AvatarStatus
}

/** Scenario status union — matches domain Scenario['status']. */
export type ScenarioStatus = 'draft' | 'active' | 'archived'

/** Canonical lifecycle status for sessions/conversations. */
export type LifecycleStatus = 'active' | 'closed' | 'archived'

/** Session-scoped avatar availability policy for a Scenario. */
export type ScenarioAvatarAvailability = {
  initialAvatarIds: string[]
  unlockableAvatarIds?: string[]
}

/** Canonical read shape for a Scenario as returned by the Core API. */
export type ScenarioSummary = {
  scenarioId: string
  name: string
  status: ScenarioStatus
  objectives: string[]
  worldContext: string
  avatarAvailability: ScenarioAvatarAvailability
  modelSelection?: ScenarioModelSelection
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

/** Canonical read shape for a Session as returned by the Core API. */
export type SessionSummary = {
  sessionId: string
  userId: string
  scenarioId: string
  activeAvatarId?: string
  unlockedAvatarIds?: string[]
  status: LifecycleStatus
  startedAt: string
  lastActivityAt: string
  endedAt?: string
}

/** Canonical read shape for a Conversation as returned by the Core API. */
export type ConversationSummary = {
  conversationId: string
  sessionId: string
  avatarId: string
  status: LifecycleStatus
  startedAt: string
  lastActivityAt: string
  endedAt?: string
}

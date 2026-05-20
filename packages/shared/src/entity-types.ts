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

/** Avatar status union — matches domain AvatarStatus. */
export type AvatarStatus = 'draft' | 'active' | 'archived'

export type AvatarLlmOverride = {
  provider?: string
  model?: string
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

/** Canonical read shape for a Scenario as returned by the Core API. */
export type ScenarioSummary = {
  scenarioId: string
  name: string
  status: ScenarioStatus
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

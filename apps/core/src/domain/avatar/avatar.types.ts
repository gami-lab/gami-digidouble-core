export type AvatarStatus = 'draft' | 'active' | 'archived'

/**
 * Avatar persistence entity aligned with DATA_MODEL.md.
 * Represents the full avatar record including persistence timestamps.
 */
export interface Avatar {
  id: string
  scenarioId: string
  name: string
  slug: string
  status: AvatarStatus
  /** Core system prompt defining character, role, and behavior. */
  personaPrompt: string
  /** Optional tone descriptor used to modulate response style. */
  tone?: string
  /** Optional human-readable avatar description. */
  description?: string
  /** Optional JSONB-backed extensible configuration. */
  config?: Record<string, unknown>
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
  slug: string
  status: AvatarStatus
  /** Core system prompt defining character, role, and behavior. */
  personaPrompt: string
  tone?: string
  description?: string
  config?: Record<string, unknown>
}

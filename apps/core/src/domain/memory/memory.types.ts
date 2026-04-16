/**
 * Memory domain types.
 *
 * Two-layer memory model:
 *   - Session memory: rolling summary of the current conversation.
 *   - User facts: persistent, structured facts extracted from interactions.
 */

export interface SessionMemory {
  sessionId: string
  summary: string
  updatedAt: string
}

export interface UserFact {
  userId: string
  /** Identifier for the fact category (e.g. "preferred_language"). */
  key: string
  value: string
  createdAt: string
  updatedAt: string
}

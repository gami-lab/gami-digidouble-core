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
  id: string
  userId: string
  category: string
  key: string
  value: string
  confidence?: number | null
  createdAt: string
  updatedAt: string
}

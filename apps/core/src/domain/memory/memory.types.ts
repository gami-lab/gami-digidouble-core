/**
 * Memory domain types.
 *
 * Two-layer memory model:
 *   - Session memory: rolling summary of the current conversation.
 *   - User facts: persistent, structured facts extracted from interactions.
 */

export type ContextMessageRole = 'user' | 'avatar' | 'system'

export type ContextMessage = {
  role: ContextMessageRole
  content: string
}

export interface SessionMemory {
  sessionId: string
  summary: string
  updatedAt: string
}

export interface AvatarSessionMemory {
  sessionId: string
  avatarId: string
  summary: string
  updatedAt: string
}

export interface UserFact {
  id: string
  userId: string
  category: string
  key: string
  value: string
  confidence?: number
  createdAt: string
  updatedAt: string
}

export type LongTermMemoryFact = Pick<UserFact, 'category' | 'key' | 'value'>

export type ShortTermMemoryExchange = {
  user: string
  avatar: string
}

export type ShortTermMemoryWindow = {
  exchangeCount: 2
  recentExchanges: ShortTermMemoryExchange[]
}

export type SessionWorkingMemorySummary = Pick<SessionMemory, 'summary' | 'updatedAt'>

export type AvatarWorkingMemorySummary = {
  avatarId: string
  summary: string
  updatedAt: string
}

export type LayeredMemorySnapshot = {
  shortTerm?: ShortTermMemoryWindow
  working?: {
    session?: SessionWorkingMemorySummary
    avatar?: AvatarWorkingMemorySummary
  }
  longTerm?: {
    facts: LongTermMemoryFact[]
  }
}

export type GameMasterMemoryContext = {
  shortTerm?: Pick<ShortTermMemoryWindow, 'recentExchanges'>
  workingSummary?: string
  longTermFacts?: LongTermMemoryFact[]
}

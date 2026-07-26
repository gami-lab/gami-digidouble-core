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

export interface ConversationWorkingMemory {
  conversationId: string
  sessionId: string
  avatarId: string
  summary: string
  unresolvedThreads: string[]
  coveredTopics: string[]
  candidateFacts: MemoryFactRecord[]
  updatedAt: string
}

export interface ConversationMemory {
  conversationId: string
  sessionId: string
  userId: string
  avatarId: string
  scenarioId: string
  summary: string
  keyDiscoveries: string[]
  unresolvedTopics: string[]
  factCandidates: MemoryFactRecord[]
  createdAt: string
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

export type MemoryFactRecord = Pick<UserFact, 'category' | 'key' | 'value'>

export type VerifiedMemoryContext = {
  source: 'canonical' | 'retrieved' | 'application_confirmed'
  content: string
}

export type LongTermMemoryFact = MemoryFactRecord

export type ShortTermMemoryExchange = {
  user: string
  avatar: string
}

export type ShortTermMemoryWindow = {
  exchangeCount: number
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
  workingMemory?: Pick<ConversationWorkingMemory, 'summary' | 'unresolvedThreads' | 'coveredTopics'>
  episodicMemories?: Array<{
    memoryId: string
    conversationId: string
    summary: string
    keyDiscoveries: string[]
    unresolvedTopics: string[]
    createdAt: string
    selectionReasons: string[]
    score: number
  }>
  longTermFacts?: LongTermMemoryFact[]
}

export type ConversationWorkingMemorySnapshot = Pick<
  ConversationWorkingMemory,
  'summary' | 'unresolvedThreads' | 'coveredTopics' | 'candidateFacts'
>

export type ConversationWorkingMemoryRefreshOutput = ConversationWorkingMemorySnapshot

export type MemorySelectionReason =
  | 'recency'
  | 'relevance'
  | 'continuity'
  | 'unresolved_topic'
  | 'working_memory'

export type SelectedEpisodicMemory = {
  memoryId: string
  conversationId: string
  summary: string
  keyDiscoveries: string[]
  unresolvedTopics: string[]
  createdAt: string
  score: number
  selectionReasons: MemorySelectionReason[]
}

export type SelectedWorkingMemory = Pick<
  ConversationWorkingMemory,
  'summary' | 'unresolvedThreads' | 'coveredTopics' | 'updatedAt'
> & {
  selectionReasons: MemorySelectionReason[]
}

export type SelectedMemoryPayload = {
  shortTermExchanges: ShortTermMemoryExchange[]
  workingMemory?: SelectedWorkingMemory
  episodicMemories: SelectedEpisodicMemory[]
  longTermFacts: LongTermMemoryFact[]
}

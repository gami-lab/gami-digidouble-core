/**
 * Canonical shared HTTP memory contract fragments.
 *
 * Ownership:
 * - Internal/domain memory contracts: apps/core/src/domain/memory/memory.types.ts
 * - HTTP/DTO memory contracts: this file (+ composed response DTOs in shared)
 */

export type SharedShortTermMemoryExchange = {
  user: string
  avatar: string
}

export type SharedShortTermMemorySnapshot = {
  exchangeCount: number
  recentExchanges: SharedShortTermMemoryExchange[]
}

export type SharedWorkingMemorySessionSummary = {
  summary: string
  updatedAt: string
}

export type SharedWorkingMemoryAvatarSummary = {
  avatarId: string
  summary: string
  updatedAt: string
}

export type SharedMemoryFactRecord = {
  category: string
  key: string
  value: string
}

export type SharedWorkingMemoryCurrent = {
  conversationId: string
  avatarId: string
  summary: string
  unresolvedThreads: string[]
  candidateFacts: SharedMemoryFactRecord[]
  updatedAt: string
}

export type SharedLongTermMemoryFact = SharedMemoryFactRecord

export type SharedLongTermAvatarMemory = {
  avatarId: string
  memories: Array<{
    conversationId: string
    summary: string
    keyDiscoveries: string[]
    unresolvedTopics: string[]
    factCandidates: SharedMemoryFactRecord[]
    createdAt: string
  }>
}

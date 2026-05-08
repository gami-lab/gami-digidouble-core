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
  exchangeCount: 2
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

export type SharedLongTermMemoryFact = {
  category: string
  key: string
  value: string
}

/**
 * Canonical shared HTTP knowledge and retrieval contract fragments.
 *
 * Ownership:
 * - Internal/domain knowledge contracts: apps/core/src/domain/knowledge/knowledge.types.ts
 * - HTTP/DTO knowledge contracts: this file (+ composed response DTOs in shared)
 */

export type KnowledgeType = 'memory' | 'world' | 'media'

export type KnowledgeSourceFormat = 'pdf' | 'text' | 'markdown' | 'url' | 'media'

export type KnowledgeSourceStatus = 'pending' | 'ready' | 'error'

export type IngestionJobStatus = 'pending' | 'running' | 'succeeded' | 'failed'

export type KnowledgeSourceDto = {
  sourceId: string
  scenarioId: string
  name: string
  knowledgeType: KnowledgeType
  format: KnowledgeSourceFormat
  uriOrPath: string
  status: KnowledgeSourceStatus
  metadata?: Record<string, unknown>
  createdAt: string
}

export type KnowledgeChunkDto = {
  chunkId: string
  sourceId: string
  content: string
  chunkIndex: number
  metadata?: Record<string, unknown>
  createdAt: string
}

export type IngestionJobDto = {
  ingestionJobId: string
  sourceId: string
  status: IngestionJobStatus
  attempts: number
  startedAt?: string
  completedAt?: string
  errorMessage?: string
  createdAt: string
}

export type RetrievedKnowledgeItemDto = {
  sourceId: string
  chunkId: string
  knowledgeType: KnowledgeType
  content: string
  score?: number
  metadata?: Record<string, unknown>
}

export type SharedContextScenarioSnapshot = {
  scenarioId: string
  name?: string
  description?: string
  goals?: string[]
}

export type SharedAvatarContextKnowledgeInjection = {
  retrievedItems: RetrievedKnowledgeItemDto[]
}

export type SharedGmContextKnowledgeInjection = {
  memory: RetrievedKnowledgeItemDto[]
  world: RetrievedKnowledgeItemDto[]
  media: RetrievedKnowledgeItemDto[]
}

import type { KnowledgeChunk } from '../../domain/knowledge/knowledge.types.js'

export type CreateKnowledgeChunkParams = {
  sourceId: string
  content: string
  chunkIndex: number
  embedding?: number[]
  metadata?: Record<string, unknown>
  visibleToAvatarIds?: string[]
}

export interface IKnowledgeChunkRepository {
  create(params: CreateKnowledgeChunkParams): Promise<KnowledgeChunk>
  listBySourceId(sourceId: string): Promise<KnowledgeChunk[]>
  listBySourceIds(sourceIds: string[]): Promise<KnowledgeChunk[]>
  deleteBySourceId(sourceId: string): Promise<number>
}

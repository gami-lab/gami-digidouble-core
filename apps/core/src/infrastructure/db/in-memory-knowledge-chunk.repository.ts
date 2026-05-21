import type {
  CreateKnowledgeChunkParams,
  IKnowledgeChunkRepository,
} from '../../application/ports/IKnowledgeChunkRepository.js'
import type { KnowledgeChunk } from '../../domain/knowledge/knowledge.types.js'

function normalizeVisibleToAvatarIds(
  visibleToAvatarIds: string[] | undefined,
): string[] | undefined {
  if (visibleToAvatarIds === undefined) return undefined
  const normalized = visibleToAvatarIds
    .map((avatarId) => avatarId.trim())
    .filter((avatarId) => avatarId.length > 0)
  return normalized.length > 0 ? normalized : undefined
}

export class InMemoryKnowledgeChunkRepository implements IKnowledgeChunkRepository {
  private readonly chunks: Map<string, KnowledgeChunk>

  constructor(initialData: KnowledgeChunk[] = []) {
    this.chunks = new Map(initialData.map((chunk) => [chunk.chunkId, chunk]))
  }

  create(params: CreateKnowledgeChunkParams): Promise<KnowledgeChunk> {
    const visibleToAvatarIds = normalizeVisibleToAvatarIds(params.visibleToAvatarIds)
    const chunk: KnowledgeChunk = {
      chunkId: `knowledge_chunk_${crypto.randomUUID()}`,
      sourceId: params.sourceId,
      content: params.content,
      chunkIndex: params.chunkIndex,
      ...(params.embedding !== undefined ? { embedding: [...params.embedding] } : {}),
      ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
      ...(visibleToAvatarIds !== undefined ? { visibleToAvatarIds } : {}),
      createdAt: new Date().toISOString(),
    }

    this.chunks.set(chunk.chunkId, chunk)
    return Promise.resolve(chunk)
  }

  listBySourceId(sourceId: string): Promise<KnowledgeChunk[]> {
    const chunks = [...this.chunks.values()]
      .filter((chunk) => chunk.sourceId === sourceId)
      .sort((a, b) => a.chunkIndex - b.chunkIndex)
    return Promise.resolve(chunks)
  }

  listBySourceIds(sourceIds: string[]): Promise<KnowledgeChunk[]> {
    const sourceSet = new Set(sourceIds)
    const chunks = [...this.chunks.values()]
      .filter((chunk) => sourceSet.has(chunk.sourceId))
      .sort((a, b) => {
        if (a.sourceId === b.sourceId) return a.chunkIndex - b.chunkIndex
        return a.sourceId.localeCompare(b.sourceId)
      })
    return Promise.resolve(chunks)
  }

  deleteBySourceId(sourceId: string): Promise<number> {
    const toDelete = [...this.chunks.values()].filter((chunk) => chunk.sourceId === sourceId)
    for (const chunk of toDelete) {
      this.chunks.delete(chunk.chunkId)
    }
    return Promise.resolve(toDelete.length)
  }
}

import type {
  CreateKnowledgeChunkParams,
  IKnowledgeChunkRepository,
} from '../../application/ports/IKnowledgeChunkRepository.js'
import type { KnowledgeChunk } from '../../domain/knowledge/knowledge.types.js'

export class InMemoryKnowledgeChunkRepository implements IKnowledgeChunkRepository {
  private readonly chunks: Map<string, KnowledgeChunk>

  constructor(initialData: KnowledgeChunk[] = []) {
    this.chunks = new Map(initialData.map((chunk) => [chunk.chunkId, chunk]))
  }

  create(params: CreateKnowledgeChunkParams): Promise<KnowledgeChunk> {
    const chunk: KnowledgeChunk = {
      chunkId: `knowledge_chunk_${crypto.randomUUID()}`,
      sourceId: params.sourceId,
      content: params.content,
      chunkIndex: params.chunkIndex,
      ...(params.embedding !== undefined ? { embedding: [...params.embedding] } : {}),
      ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
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

  deleteBySourceId(sourceId: string): Promise<number> {
    const toDelete = [...this.chunks.values()].filter((chunk) => chunk.sourceId === sourceId)
    for (const chunk of toDelete) {
      this.chunks.delete(chunk.chunkId)
    }
    return Promise.resolve(toDelete.length)
  }
}

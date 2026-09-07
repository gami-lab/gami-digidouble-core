import type {
  CreateKnowledgeChunkParams,
  IKnowledgeChunkRepository,
} from '../../application/ports/IKnowledgeChunkRepository.js'
import type { KnowledgeChunk } from '../../domain/knowledge/knowledge.types.js'
import type { ActiveCorpus } from '../../application/ports/IKnowledgeCorpusRepository.js'
import type { StagedKnowledgeChunk } from '../../application/ports/IKnowledgeCorpusRepository.js'

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
  private activeCorpus: ActiveCorpus | null = null

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
      ...(params.embeddingProfileId !== undefined
        ? { embeddingProfileId: params.embeddingProfileId }
        : {}),
      ...(params.corpusGenerationId !== undefined
        ? { corpusGenerationId: params.corpusGenerationId }
        : {}),
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
      .filter((chunk) => this.isVisibleInActiveCorpus(chunk))
      .sort((a, b) => a.chunkIndex - b.chunkIndex)
    return Promise.resolve(chunks)
  }

  listBySourceIds(sourceIds: string[]): Promise<KnowledgeChunk[]> {
    const sourceSet = new Set(sourceIds)
    const chunks = [...this.chunks.values()]
      .filter((chunk) => sourceSet.has(chunk.sourceId))
      .filter((chunk) => this.isVisibleInActiveCorpus(chunk))
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

  deleteBySourceIdAndGeneration(sourceId: string, corpusGenerationId: string): number {
    const toDelete = [...this.chunks.values()].filter(
      (chunk) => chunk.sourceId === sourceId && chunk.corpusGenerationId === corpusGenerationId,
    )
    for (const chunk of toDelete) this.chunks.delete(chunk.chunkId)
    return toDelete.length
  }

  replaceChunksForGeneration(
    sourceId: string,
    corpusGenerationId: string,
    chunks: readonly StagedKnowledgeChunk[],
  ): number {
    this.deleteBySourceIdAndGeneration(sourceId, corpusGenerationId)
    for (const chunk of chunks) {
      const stored: KnowledgeChunk = {
        chunkId: `knowledge_chunk_${crypto.randomUUID()}`,
        sourceId: chunk.sourceId,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        embedding: [...chunk.embedding],
        embeddingProfileId: chunk.embeddingProfileId,
        corpusGenerationId: chunk.corpusGenerationId,
        ...(chunk.metadata !== undefined ? { metadata: { ...chunk.metadata } } : {}),
        ...(chunk.visibleToAvatarIds !== undefined
          ? { visibleToAvatarIds: [...chunk.visibleToAvatarIds] }
          : {}),
        createdAt: new Date().toISOString(),
      }
      this.chunks.set(stored.chunkId, stored)
    }
    return chunks.length
  }

  setActiveCorpus(activeCorpus: ActiveCorpus | null): void {
    this.activeCorpus = activeCorpus
  }

  listAllBySourceIds(sourceIds: readonly string[]): KnowledgeChunk[] {
    const sourceSet = new Set(sourceIds)
    return [...this.chunks.values()].filter((chunk) => sourceSet.has(chunk.sourceId))
  }

  private isVisibleInActiveCorpus(chunk: KnowledgeChunk): boolean {
    if (this.activeCorpus === null) return chunk.corpusGenerationId === undefined
    return (
      chunk.corpusGenerationId === this.activeCorpus.corpusGenerationId &&
      chunk.embeddingProfileId === this.activeCorpus.embeddingProfileId
    )
  }
}

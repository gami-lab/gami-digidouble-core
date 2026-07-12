import { DomainError } from '../../../domain/errors.js'
import type { IKnowledgeChunkRepository } from '../../ports/IKnowledgeChunkRepository.js'
import type { IKnowledgeSourceRepository } from '../../ports/IKnowledgeSourceRepository.js'
import type {
  ListKnowledgeChunksInput,
  ListKnowledgeChunksOutput,
} from './list-knowledge-chunks.types.js'

export class ListKnowledgeChunksUseCase {
  constructor(
    private readonly sourceRepository: IKnowledgeSourceRepository,
    private readonly chunkRepository: IKnowledgeChunkRepository,
  ) {}

  async execute(input: ListKnowledgeChunksInput): Promise<ListKnowledgeChunksOutput> {
    const sourceId = input.sourceId.trim()
    if (sourceId.length === 0) {
      throw new DomainError('VALIDATION_ERROR', 'sourceId must be a non-empty string.')
    }

    const source = await this.sourceRepository.findById(sourceId)
    if (source === null) {
      throw new DomainError('NOT_FOUND', `Knowledge source ${sourceId} not found.`)
    }

    const chunks = await this.chunkRepository.listBySourceId(sourceId)

    return {
      chunks: chunks.map((chunk) => ({
        chunkId: chunk.chunkId,
        sourceId: chunk.sourceId,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        ...(chunk.metadata !== undefined ? { metadata: chunk.metadata } : {}),
        ...(chunk.visibleToAvatarIds !== undefined
          ? { visibleToAvatarIds: chunk.visibleToAvatarIds }
          : {}),
        createdAt: chunk.createdAt,
      })),
    }
  }
}

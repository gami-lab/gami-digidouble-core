import { DomainError } from '../../../domain/errors.js'
import type { IKnowledgeChunkRepository } from '../../ports/IKnowledgeChunkRepository.js'
import type { IKnowledgeSourceRepository } from '../../ports/IKnowledgeSourceRepository.js'
import type {
  DeleteKnowledgeSourceInput,
  DeleteKnowledgeSourceOutput,
} from './delete-knowledge-source.types.js'

export class DeleteKnowledgeSourceUseCase {
  constructor(
    private readonly sourceRepository: IKnowledgeSourceRepository,
    private readonly chunkRepository: IKnowledgeChunkRepository,
  ) {}

  async execute(input: DeleteKnowledgeSourceInput): Promise<DeleteKnowledgeSourceOutput> {
    const source = await this.sourceRepository.findById(input.sourceId)
    if (source === null) {
      throw new DomainError('NOT_FOUND', 'Knowledge source not found')
    }

    await this.chunkRepository.deleteBySourceId(input.sourceId)
    await this.sourceRepository.delete(input.sourceId)

    return { sourceId: input.sourceId, deleted: true }
  }
}

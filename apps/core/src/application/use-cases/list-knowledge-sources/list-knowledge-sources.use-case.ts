import { DomainError } from '../../../domain/errors.js'
import type { IKnowledgeSourceRepository } from '../../ports/IKnowledgeSourceRepository.js'
import type {
  ListKnowledgeSourcesInput,
  ListKnowledgeSourcesOutput,
} from './list-knowledge-sources.types.js'

const ALLOWED_TYPES = new Set(['memory', 'world', 'media'])
const ALLOWED_STATUS = new Set(['pending', 'ready', 'error'])

export class ListKnowledgeSourcesUseCase {
  constructor(private readonly sourceRepository: IKnowledgeSourceRepository) {}

  async execute(input: ListKnowledgeSourcesInput): Promise<ListKnowledgeSourcesOutput> {
    const scenarioId = input.scenarioId.trim()
    if (scenarioId.length === 0) {
      throw new DomainError('VALIDATION_ERROR', 'scenarioId must be a non-empty string.')
    }

    if (input.knowledgeType !== undefined && !ALLOWED_TYPES.has(input.knowledgeType)) {
      throw new DomainError(
        'VALIDATION_ERROR',
        'knowledgeType must be one of: memory, world, media.',
      )
    }
    if (input.status !== undefined && !ALLOWED_STATUS.has(input.status)) {
      throw new DomainError('VALIDATION_ERROR', 'status must be one of: pending, ready, error.')
    }

    const sources = await this.sourceRepository.listByScenario({
      scenarioId,
      ...(input.knowledgeType !== undefined ? { knowledgeType: input.knowledgeType } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    })

    return {
      sources: sources.map((source) => ({
        sourceId: source.sourceId,
        scenarioId: source.scenarioId,
        name: source.name,
        knowledgeType: source.knowledgeType,
        format: source.format,
        uriOrPath: source.uriOrPath,
        status: source.status,
        createdAt: source.createdAt,
        ...(source.metadata !== undefined ? { metadata: source.metadata } : {}),
      })),
    }
  }
}

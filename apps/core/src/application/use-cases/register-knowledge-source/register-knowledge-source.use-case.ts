import { DomainError } from '../../../domain/errors.js'
import type { IIngestionJobRepository } from '../../ports/IIngestionJobRepository.js'
import type { IKnowledgeSourceRepository } from '../../ports/IKnowledgeSourceRepository.js'
import { KnowledgeIngestionService } from '../../services/knowledge/knowledge-ingestion.service.js'
import type {
  RegisterKnowledgeSourceInput,
  RegisterKnowledgeSourceOutput,
} from './register-knowledge-source.types.js'

const ALLOWED_FORMATS = new Set(['text', 'markdown', 'pdf', 'url', 'media'])
const ALLOWED_TYPES = new Set(['memory', 'world', 'media'])

export class RegisterKnowledgeSourceUseCase {
  constructor(
    private readonly sourceRepository: IKnowledgeSourceRepository,
    private readonly ingestionJobRepository: IIngestionJobRepository,
    private readonly ingestionService: KnowledgeIngestionService,
  ) {}

  async execute(input: RegisterKnowledgeSourceInput): Promise<RegisterKnowledgeSourceOutput> {
    const name = input.name.trim()
    const uriOrPath = input.uriOrPath.trim()

    if (name.length === 0) {
      throw new DomainError('VALIDATION_ERROR', 'name must be a non-empty string.')
    }
    if (uriOrPath.length === 0) {
      throw new DomainError('VALIDATION_ERROR', 'uriOrPath must be a non-empty string.')
    }
    if (!ALLOWED_TYPES.has(input.knowledgeType)) {
      throw new DomainError(
        'VALIDATION_ERROR',
        'knowledgeType must be one of: memory, world, media.',
      )
    }
    if (!ALLOWED_FORMATS.has(input.format)) {
      throw new DomainError(
        'VALIDATION_ERROR',
        'format must be one of: text, markdown, pdf, url, media.',
      )
    }

    const source = await this.sourceRepository.create({
      scenarioId: input.scenarioId,
      name,
      knowledgeType: input.knowledgeType,
      format: input.format,
      uriOrPath,
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    })

    const job = await this.ingestionJobRepository.create({
      sourceId: source.sourceId,
      status: 'queued',
      attempts: 0,
    })

    const triggerIngestion = input.triggerIngestion ?? true
    if (triggerIngestion) {
      void this.ingestionService
        .execute({
          sourceId: source.sourceId,
          ingestionJobId: job.ingestionJobId,
          ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
        })
        .catch((error: unknown) => {
          console.error('[knowledge-ingestion] Background ingestion execution failed:', error)
        })
    }

    return {
      source,
      ingestionJob: job,
      ingestionScheduled: triggerIngestion,
    }
  }
}

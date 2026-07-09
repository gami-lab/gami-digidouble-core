import { DomainError } from '../../../domain/errors.js'
import type { IKnowledgeSourceRepository } from '../../ports/IKnowledgeSourceRepository.js'
import type {
  CreateKnowledgeSourceInput,
  CreateKnowledgeSourceOutput,
} from './create-knowledge-source.types.js'

export class CreateKnowledgeSourceUseCase {
  constructor(private readonly sourceRepository: IKnowledgeSourceRepository) {}

  async execute(input: CreateKnowledgeSourceInput): Promise<CreateKnowledgeSourceOutput> {
    const scenarioId = input.scenarioId.trim()
    const name = input.name.trim()
    const uriOrPath = input.uriOrPath.trim()

    if (scenarioId.length === 0 || name.length === 0 || uriOrPath.length === 0) {
      throw new DomainError(
        'VALIDATION_ERROR',
        'scenarioId, name and uriOrPath must be non-empty strings.',
      )
    }

    const source = await this.sourceRepository.create({
      scenarioId,
      name,
      knowledgeType: input.knowledgeType,
      format: input.format,
      uriOrPath,
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(input.visibilityPolicy !== undefined ? { visibilityPolicy: input.visibilityPolicy } : {}),
      ...(input.visibleToAvatarIds !== undefined
        ? { visibleToAvatarIds: input.visibleToAvatarIds }
        : {}),
    })

    return {
      source: {
        sourceId: source.sourceId,
        scenarioId: source.scenarioId,
        name: source.name,
        knowledgeType: source.knowledgeType,
        format: source.format,
        uriOrPath: source.uriOrPath,
        status: source.status,
        ...(source.visibilityPolicy !== undefined
          ? { visibilityPolicy: source.visibilityPolicy }
          : {}),
        ...(source.visibleToAvatarIds !== undefined
          ? { visibleToAvatarIds: source.visibleToAvatarIds }
          : {}),
        createdAt: source.createdAt,
        ...(source.metadata !== undefined ? { metadata: source.metadata } : {}),
      },
    }
  }
}

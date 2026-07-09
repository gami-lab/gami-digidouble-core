import { DomainError } from '../../../domain/errors.js'
import type {
  IKnowledgeSourceRepository,
  UpdateKnowledgeSourceParams,
} from '../../ports/IKnowledgeSourceRepository.js'
import type {
  UpdateKnowledgeSourceInput,
  UpdateKnowledgeSourceOutput,
} from './update-knowledge-source.types.js'

export class UpdateKnowledgeSourceUseCase {
  constructor(private readonly sourceRepository: IKnowledgeSourceRepository) {}

  async execute(input: UpdateKnowledgeSourceInput): Promise<UpdateKnowledgeSourceOutput> {
    const updates = buildUpdates(input)

    if (Object.keys(updates).length === 0) {
      throw new DomainError('INVALID_INPUT', 'At least one field must be provided for update')
    }

    const source = await this.sourceRepository.update(input.sourceId, updates)
    if (source === null) {
      throw new DomainError('NOT_FOUND', 'Knowledge source not found')
    }

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

function assertNonEmptyWhenProvided(value: string | undefined, fieldName: string): void {
  if (value !== undefined && value.trim().length === 0) {
    throw new DomainError(
      'VALIDATION_ERROR',
      `${fieldName} must be a non-empty string when provided.`,
    )
  }
}

function buildUpdates(input: UpdateKnowledgeSourceInput): UpdateKnowledgeSourceParams {
  const { name, metadata, visibilityPolicy, visibleToAvatarIds, uriOrPath } = input

  assertNonEmptyWhenProvided(name, 'name')
  assertNonEmptyWhenProvided(uriOrPath, 'uriOrPath')

  const ingestionInputsChanged = metadata !== undefined || uriOrPath !== undefined

  return {
    ...(name !== undefined ? { name: name.trim() } : {}),
    ...(uriOrPath !== undefined ? { uriOrPath: uriOrPath.trim() } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
    ...(visibilityPolicy !== undefined ? { visibilityPolicy } : {}),
    ...(visibleToAvatarIds !== undefined ? { visibleToAvatarIds } : {}),
    ...(ingestionInputsChanged ? { status: 'pending' as const } : {}),
  }
}

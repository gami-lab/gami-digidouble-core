import { DomainError } from '../../../domain/errors.js'
import {
  buildKnowledgeVisibilitySelection,
  getKnowledgeVisibilityValidationError,
  normalizeKnowledgeVisibilitySelection,
} from '../../../domain/knowledge/knowledge-visibility.js'
import type { IKnowledgeSourceRepository } from '../../ports/IKnowledgeSourceRepository.js'
import type {
  CreateKnowledgeSourceInput,
  CreateKnowledgeSourceOutput,
} from './create-knowledge-source.types.js'

type NormalizedCreateKnowledgeSource = {
  scenarioId: string
  name: string
  uriOrPath: string
  visibility: ReturnType<typeof normalizeKnowledgeVisibilitySelection>
}

export class CreateKnowledgeSourceUseCase {
  constructor(private readonly sourceRepository: IKnowledgeSourceRepository) {}

  async execute(input: CreateKnowledgeSourceInput): Promise<CreateKnowledgeSourceOutput> {
    const normalized = normalizeCreateKnowledgeSourceInput(input)

    const source = await this.sourceRepository.create({
      scenarioId: normalized.scenarioId,
      name: normalized.name,
      knowledgeType: input.knowledgeType,
      format: input.format,
      uriOrPath: normalized.uriOrPath,
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(normalized.visibility.visibilityPolicy !== undefined
        ? { visibilityPolicy: normalized.visibility.visibilityPolicy }
        : {}),
      ...(normalized.visibility.visibleToAvatarIds !== undefined
        ? { visibleToAvatarIds: normalized.visibility.visibleToAvatarIds }
        : {}),
    })

    return presentCreateKnowledgeSourceOutput(source)
  }
}

function normalizeCreateKnowledgeSourceInput(
  input: CreateKnowledgeSourceInput,
): NormalizedCreateKnowledgeSource {
  const scenarioId = input.scenarioId.trim()
  const name = input.name.trim()
  const uriOrPath = input.uriOrPath.trim()
  const visibility = normalizeKnowledgeVisibilitySelection(
    buildKnowledgeVisibilitySelection(input.visibilityPolicy, input.visibleToAvatarIds),
    { inferAvatarPolicyFromIds: true },
  )

  if (scenarioId.length === 0 || name.length === 0 || uriOrPath.length === 0) {
    throw new DomainError(
      'VALIDATION_ERROR',
      'scenarioId, name and uriOrPath must be non-empty strings.',
    )
  }

  const visibilityError = getKnowledgeVisibilityValidationError(visibility)
  if (visibilityError !== null) {
    throw new DomainError('VALIDATION_ERROR', visibilityError)
  }

  return { scenarioId, name, uriOrPath, visibility }
}

function presentCreateKnowledgeSourceOutput(
  source: CreateKnowledgeSourceOutput['source'],
): CreateKnowledgeSourceOutput {
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

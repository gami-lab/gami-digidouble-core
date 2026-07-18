import { DomainError } from '../../../domain/errors.js'
import {
  buildKnowledgeVisibilitySelection,
  getKnowledgeVisibilityValidationError,
  normalizeKnowledgeVisibilitySelection,
  normalizeVisibleToAvatarIds,
} from '../../../domain/knowledge/knowledge-visibility.js'
import { toKnowledgeSourceDto } from '../../../domain/knowledge/knowledge-source-presenter.js'
import type { KnowledgeSource } from '../../../domain/knowledge/knowledge.types.js'
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
    const existing = await this.sourceRepository.findById(input.sourceId)
    if (existing === null) {
      throw new DomainError('NOT_FOUND', 'Knowledge source not found')
    }

    const updates = buildUpdates(input, existing)
    if (Object.keys(updates).length === 0) {
      throw new DomainError('INVALID_INPUT', 'At least one field must be provided for update')
    }

    const source = await this.sourceRepository.update(input.sourceId, updates)
    if (source === null) {
      throw new DomainError('NOT_FOUND', 'Knowledge source not found')
    }

    return { source: toKnowledgeSourceDto(source) }
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

function sameAvatarScope(left: string[] | undefined, right: string[] | undefined): boolean {
  if (left === undefined && right === undefined) return true
  if (left === undefined || right === undefined) return false
  if (left.length !== right.length) return false
  return left.every((avatarId, index) => avatarId === right[index])
}

type VisibilityTransition = {
  currentVisibility: ReturnType<typeof normalizeKnowledgeVisibilitySelection>
  nextVisibility: ReturnType<typeof normalizeKnowledgeVisibilitySelection>
  currentVisibleToAvatarIds: string[] | undefined
  nextVisibleToAvatarIds: string[] | undefined
}

function buildUpdates(
  input: UpdateKnowledgeSourceInput,
  existing: KnowledgeSource,
): UpdateKnowledgeSourceParams {
  const { name, metadata, visibilityPolicy, visibleToAvatarIds, uriOrPath } = input

  assertNonEmptyWhenProvided(name, 'name')
  assertNonEmptyWhenProvided(uriOrPath, 'uriOrPath')
  const visibility = resolveVisibilityTransition(existing, visibilityPolicy, visibleToAvatarIds)
  const ingestionInputsChanged = metadata !== undefined || uriOrPath !== undefined

  return {
    ...(name !== undefined ? { name: name.trim() } : {}),
    ...(uriOrPath !== undefined ? { uriOrPath: uriOrPath.trim() } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
    ...buildVisibilityUpdates(visibility, visibilityPolicy, visibleToAvatarIds),
    ...(ingestionInputsChanged ? { status: 'pending' as const } : {}),
  }
}

function resolveVisibilityTransition(
  existing: KnowledgeSource,
  visibilityPolicy: UpdateKnowledgeSourceInput['visibilityPolicy'],
  visibleToAvatarIds: UpdateKnowledgeSourceInput['visibleToAvatarIds'],
): VisibilityTransition {
  const currentVisibility = normalizeKnowledgeVisibilitySelection(
    buildKnowledgeVisibilitySelection(existing.visibilityPolicy, existing.visibleToAvatarIds),
    { inferAvatarPolicyFromIds: true },
  )
  const nextVisibility = normalizeKnowledgeVisibilitySelection(
    buildKnowledgeVisibilitySelection(
      visibilityPolicy ?? existing.visibilityPolicy,
      visibleToAvatarIds ?? existing.visibleToAvatarIds,
    ),
    { inferAvatarPolicyFromIds: true },
  )
  const visibilityError = getKnowledgeVisibilityValidationError(nextVisibility)
  if (visibilityError !== null) {
    throw new DomainError('VALIDATION_ERROR', visibilityError)
  }

  return {
    currentVisibility,
    nextVisibility,
    currentVisibleToAvatarIds: normalizeVisibleToAvatarIds(currentVisibility.visibleToAvatarIds),
    nextVisibleToAvatarIds: normalizeVisibleToAvatarIds(nextVisibility.visibleToAvatarIds),
  }
}

function buildVisibilityUpdates(
  visibility: VisibilityTransition,
  visibilityPolicy: UpdateKnowledgeSourceInput['visibilityPolicy'],
  visibleToAvatarIds: UpdateKnowledgeSourceInput['visibleToAvatarIds'],
): Pick<UpdateKnowledgeSourceParams, 'visibilityPolicy' | 'visibleToAvatarIds'> {
  return {
    ...(visibilityPolicy !== undefined ||
    visibility.currentVisibility.visibilityPolicy !== visibility.nextVisibility.visibilityPolicy
      ? { visibilityPolicy: visibility.nextVisibility.visibilityPolicy }
      : {}),
    ...(visibleToAvatarIds !== undefined ||
    visibilityPolicy !== undefined ||
    !sameAvatarScope(visibility.currentVisibleToAvatarIds, visibility.nextVisibleToAvatarIds)
      ? { visibleToAvatarIds: visibility.nextVisibleToAvatarIds ?? [] }
      : {}),
  }
}

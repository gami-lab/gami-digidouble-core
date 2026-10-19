import { MEDIA_LIMITS, type MediaRef } from '@gami/shared'
import { DomainError } from '../../../domain/errors.js'
import type { IMediaAssetRepository } from '../../ports/IMediaAssetRepository.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'

export async function requireScenario(
  scenarioRepository: IScenarioRepository,
  scenarioId: string,
): Promise<void> {
  if ((await scenarioRepository.findById(scenarioId)) === null) {
    throw new DomainError('NOT_FOUND', 'Scenario not found')
  }
}

export function normalizeDescription(value: string): string {
  const description = value.trim()
  if (description.length === 0 || description.length > MEDIA_LIMITS.descriptionMaxLength) {
    throw new DomainError(
      'VALIDATION_ERROR',
      `description must be 1-${String(MEDIA_LIMITS.descriptionMaxLength)} characters.`,
    )
  }
  return description
}

export function assertDurationMs(value: number | null | undefined): void {
  if (value === null || value === undefined) return
  if (!Number.isInteger(value) || value < 0 || value > MEDIA_LIMITS.durationMsMax) {
    throw new DomainError('VALIDATION_ERROR', 'durationMs must be a non-negative integer.')
  }
}

/** A poster is an image asset of the same scenario, never the asset itself. */
export async function assertPoster(
  repository: IMediaAssetRepository,
  scenarioId: string,
  posterAssetId: MediaRef | null | undefined,
  assetId?: MediaRef,
): Promise<void> {
  if (posterAssetId === null || posterAssetId === undefined) return
  const [poster] = await repository.findByIds(scenarioId, [posterAssetId])
  if (poster === undefined || poster.kind !== 'image' || poster.assetId === assetId) {
    throw new DomainError(
      'VALIDATION_ERROR',
      'posterAssetId must reference another image asset of this scenario.',
    )
  }
}

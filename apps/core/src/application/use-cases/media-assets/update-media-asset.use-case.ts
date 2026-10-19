import type { MediaAssetSummary, MediaRef, UpdateMediaAssetRequest } from '@gami/shared'
import { DomainError } from '../../../domain/errors.js'
import type { IMediaAssetRepository } from '../../ports/IMediaAssetRepository.js'
import { toMediaAssetSummary } from '../../services/media/media-asset-projection.js'
import { assertDurationMs, assertPoster, normalizeDescription } from './media-asset-input.js'

export class UpdateMediaAssetUseCase {
  constructor(private readonly mediaAssetRepository: IMediaAssetRepository) {}

  async execute(assetId: MediaRef, request: UpdateMediaAssetRequest): Promise<MediaAssetSummary> {
    const existing = await this.mediaAssetRepository.findById(assetId)
    if (existing === null) throw new DomainError('NOT_FOUND', 'Media asset not found')
    assertDurationMs(request.durationMs)
    await assertPoster(
      this.mediaAssetRepository,
      existing.scenarioId,
      request.posterAssetId,
      existing.assetId,
    )

    const updated = await this.mediaAssetRepository.update(assetId, {
      ...(request.description !== undefined
        ? { description: normalizeDescription(request.description) }
        : {}),
      ...(request.cueable !== undefined ? { cueable: request.cueable } : {}),
      ...(request.posterAssetId !== undefined ? { posterAssetId: request.posterAssetId } : {}),
      ...(request.durationMs !== undefined ? { durationMs: request.durationMs } : {}),
    })
    if (updated === null) throw new DomainError('NOT_FOUND', 'Media asset not found')
    return toMediaAssetSummary(updated)
  }
}

import { randomUUID } from 'node:crypto'
import {
  mediaKindForMimeType,
  type CreateUrlMediaAssetRequest,
  type MediaAssetSummary,
} from '@gami/shared'
import { DomainError } from '../../../domain/errors.js'
import type { IMediaAssetRepository } from '../../ports/IMediaAssetRepository.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import { toMediaAssetSummary } from '../../services/media/media-asset-projection.js'
import {
  assertDurationMs,
  assertPoster,
  normalizeDescription,
  requireScenario,
} from './media-asset-input.js'

export class CreateUrlMediaAssetUseCase {
  constructor(
    private readonly scenarioRepository: IScenarioRepository,
    private readonly mediaAssetRepository: IMediaAssetRepository,
  ) {}

  async execute(
    scenarioId: string,
    request: CreateUrlMediaAssetRequest,
  ): Promise<MediaAssetSummary> {
    await requireScenario(this.scenarioRepository, scenarioId)
    const kind = mediaKindForMimeType(request.mimeType)
    if (kind === null) throw new DomainError('VALIDATION_ERROR', 'Unsupported media type.')
    const description = normalizeDescription(request.description)
    assertDurationMs(request.durationMs)
    await assertPoster(this.mediaAssetRepository, scenarioId, request.posterAssetId)

    const asset = await this.mediaAssetRepository.create({
      assetId: `media_${randomUUID()}`,
      scenarioId,
      kind,
      source: 'url',
      storageKey: null,
      url: request.url,
      mimeType: request.mimeType,
      byteSize: null,
      posterAssetId: request.posterAssetId ?? null,
      durationMs: request.durationMs ?? null,
      description,
      cueable: request.cueable ?? false,
    })
    return toMediaAssetSummary(asset)
  }
}

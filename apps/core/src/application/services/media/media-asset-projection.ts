import type { MediaAssetSummary, MediaRef, PublicMediaAsset } from '@gami/shared'
import type { MediaAsset } from '../../../domain/media/media-asset.types.js'
import type { IMediaAssetRepository } from '../../ports/IMediaAssetRepository.js'
import type { PublicMediaLookup } from './public-presentation.js'

/** Uploads are served by Core's open file route; the path is relative to the Core API origin. */
export function mediaFileUrl(asset: Pick<MediaAsset, 'assetId' | 'url'>): string {
  return asset.url ?? `/v1/media/${asset.assetId}`
}

export function toMediaAssetSummary(asset: MediaAsset): MediaAssetSummary {
  return {
    assetId: asset.assetId,
    scenarioId: asset.scenarioId,
    kind: asset.kind,
    source: asset.source,
    mimeType: asset.mimeType,
    byteSize: asset.byteSize,
    url: asset.url,
    fileUrl: mediaFileUrl(asset),
    previewUrl: asset.url ?? `/v1/admin/media/${asset.assetId}/file`,
    posterAssetId: asset.posterAssetId,
    durationMs: asset.durationMs,
    description: asset.description,
    cueable: asset.cueable,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  }
}

export function toPublicMediaAsset(asset: MediaAsset, poster?: MediaAsset): PublicMediaAsset {
  return {
    assetId: asset.assetId,
    kind: asset.kind,
    url: mediaFileUrl(asset),
    ...(poster !== undefined ? { posterUrl: mediaFileUrl(poster) } : {}),
    ...(asset.durationMs !== null ? { durationMs: asset.durationMs } : {}),
    description: asset.description,
  }
}

/** Resolves assets and their posters to player projections in two bounded reads. */
export async function findPublicMediaAssets(
  repository: IMediaAssetRepository,
  scenarioId: string,
  assetIds: readonly MediaRef[],
): Promise<Map<MediaRef, PublicMediaAsset>> {
  const assets = await repository.findByIds(scenarioId, [...new Set(assetIds)])
  const posterIds = assets.flatMap((asset) =>
    asset.posterAssetId !== null ? [asset.posterAssetId] : [],
  )
  const posters =
    posterIds.length === 0 ? [] : await repository.findByIds(scenarioId, [...new Set(posterIds)])
  const posterById = new Map(posters.map((poster) => [poster.assetId, poster]))
  return new Map(
    assets.map((asset) => [
      asset.assetId,
      toPublicMediaAsset(
        asset,
        asset.posterAssetId !== null ? posterById.get(asset.posterAssetId) : undefined,
      ),
    ]),
  )
}

export function createPublicMediaLookup(repository: IMediaAssetRepository): PublicMediaLookup {
  return (scenarioId, assetIds) => findPublicMediaAssets(repository, scenarioId, assetIds)
}

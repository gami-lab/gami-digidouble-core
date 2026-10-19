import type { MediaRef } from '@gami/shared'
import type { MediaAsset } from '../../domain/media/media-asset.types.js'

export interface IMediaAssetRepository {
  create(params: CreateMediaAssetParams): Promise<MediaAsset>
  findById(assetId: MediaRef): Promise<MediaAsset | null>
  /** Assets of one scenario among `assetIds`; ids of other scenarios or unknown ids are absent. */
  findByIds(scenarioId: string, assetIds: readonly MediaRef[]): Promise<MediaAsset[]>
  listByScenario(scenarioId: string): Promise<MediaAsset[]>
  update(assetId: MediaRef, updates: UpdateMediaAssetParams): Promise<MediaAsset | null>
  delete(assetId: MediaRef): Promise<void>
}

export type CreateMediaAssetParams = Omit<MediaAsset, 'createdAt' | 'updatedAt'>

export type UpdateMediaAssetParams = Partial<
  Pick<MediaAsset, 'description' | 'cueable' | 'posterAssetId' | 'durationMs'>
>

import type { MediaRef } from '@gami/shared'
import type {
  CreateMediaAssetParams,
  IMediaAssetRepository,
  UpdateMediaAssetParams,
} from '../../application/ports/IMediaAssetRepository.js'
import type { MediaAsset } from '../../domain/media/media-asset.types.js'

export class InMemoryMediaAssetRepository implements IMediaAssetRepository {
  private readonly assets = new Map<MediaRef, MediaAsset>()

  constructor(initial: MediaAsset[] = []) {
    for (const asset of initial) this.assets.set(asset.assetId, asset)
  }

  create(params: CreateMediaAssetParams): Promise<MediaAsset> {
    const now = new Date().toISOString()
    const asset: MediaAsset = { ...params, createdAt: now, updatedAt: now }
    this.assets.set(asset.assetId, asset)
    return Promise.resolve({ ...asset })
  }

  findById(assetId: MediaRef): Promise<MediaAsset | null> {
    const asset = this.assets.get(assetId)
    return Promise.resolve(asset === undefined ? null : { ...asset })
  }

  findByIds(scenarioId: string, assetIds: readonly MediaRef[]): Promise<MediaAsset[]> {
    const wanted = new Set(assetIds)
    return Promise.resolve(
      [...this.assets.values()]
        .filter((asset) => asset.scenarioId === scenarioId && wanted.has(asset.assetId))
        .map((asset) => ({ ...asset })),
    )
  }

  listByScenario(scenarioId: string): Promise<MediaAsset[]> {
    return Promise.resolve(
      [...this.assets.values()]
        .filter((asset) => asset.scenarioId === scenarioId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((asset) => ({ ...asset })),
    )
  }

  update(assetId: MediaRef, updates: UpdateMediaAssetParams): Promise<MediaAsset | null> {
    const existing = this.assets.get(assetId)
    if (existing === undefined) return Promise.resolve(null)
    const updated: MediaAsset = { ...existing, ...updates, updatedAt: new Date().toISOString() }
    this.assets.set(assetId, updated)
    return Promise.resolve({ ...updated })
  }

  delete(assetId: MediaRef): Promise<void> {
    this.assets.delete(assetId)
    return Promise.resolve()
  }
}

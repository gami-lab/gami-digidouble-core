import type { Readable } from 'node:stream'
import type { MediaRef } from '@gami/shared'
import type { MediaAsset } from '../../../domain/media/media-asset.types.js'
import type { IMediaAssetRepository } from '../../ports/IMediaAssetRepository.js'
import type { ByteRange, IMediaStorage } from '../../ports/IMediaStorage.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'

export type ServableMediaFile = {
  asset: MediaAsset & { storageKey: string }
  byteSize: number
}

/**
 * Finds the stored file of an uploaded asset. The player route serves media without a credential,
 * so it asks for active scenarios only; anything else is indistinguishable from an unknown id.
 */
export class ReadMediaFileUseCase {
  constructor(
    private readonly scenarioRepository: IScenarioRepository,
    private readonly mediaAssetRepository: IMediaAssetRepository,
    private readonly mediaStorage: IMediaStorage,
  ) {}

  async find(
    assetId: MediaRef,
    options: { activeScenarioOnly: boolean },
  ): Promise<ServableMediaFile | null> {
    const asset = await this.mediaAssetRepository.findById(assetId)
    if (asset?.storageKey == null) return null
    if (options.activeScenarioOnly) {
      const scenario = await this.scenarioRepository.findById(asset.scenarioId)
      if (scenario?.status !== 'active') return null
    }
    const file = await this.mediaStorage.stat(asset.storageKey)
    if (file === null) return null
    return { asset: { ...asset, storageKey: asset.storageKey }, byteSize: file.byteSize }
  }

  open(file: ServableMediaFile, range?: ByteRange): Promise<Readable | null> {
    return this.mediaStorage.openRead(file.asset.storageKey, range)
  }
}

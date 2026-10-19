import type { MediaRef } from '@gami/shared'
import { DomainError } from '../../../domain/errors.js'
import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IMediaAssetRepository } from '../../ports/IMediaAssetRepository.js'
import type { IMediaStorage } from '../../ports/IMediaStorage.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import { findMediaUsages } from '../../services/media/media-references.js'

export class DeleteMediaAssetUseCase {
  constructor(
    private readonly scenarioRepository: IScenarioRepository,
    private readonly avatarRepository: IAvatarRepository,
    private readonly mediaAssetRepository: IMediaAssetRepository,
    private readonly mediaStorage: IMediaStorage,
  ) {}

  async execute(assetId: MediaRef): Promise<void> {
    const asset = await this.mediaAssetRepository.findById(assetId)
    if (asset === null) throw new DomainError('NOT_FOUND', 'Media asset not found')
    const [scenario, avatars, assets] = await Promise.all([
      this.scenarioRepository.findById(asset.scenarioId),
      this.avatarRepository.listByScenarioId(asset.scenarioId),
      this.mediaAssetRepository.listByScenario(asset.scenarioId),
    ])
    if (scenario === null) throw new DomainError('NOT_FOUND', 'Media asset not found')
    const usages = findMediaUsages(asset.assetId, scenario, avatars, assets)
    if (usages.length > 0) {
      throw new DomainError('CONFLICT', `Media asset is in use: ${usages.join(', ')}.`, {
        usages,
      })
    }

    await this.mediaAssetRepository.delete(asset.assetId)
    if (asset.storageKey !== null) await this.mediaStorage.delete(asset.storageKey)
  }
}

import type { MediaAssetSummary } from '@gami/shared'
import type { IMediaAssetRepository } from '../../ports/IMediaAssetRepository.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import { toMediaAssetSummary } from '../../services/media/media-asset-projection.js'
import { requireScenario } from './media-asset-input.js'

export class ListMediaAssetsUseCase {
  constructor(
    private readonly scenarioRepository: IScenarioRepository,
    private readonly mediaAssetRepository: IMediaAssetRepository,
  ) {}

  async execute(scenarioId: string): Promise<MediaAssetSummary[]> {
    await requireScenario(this.scenarioRepository, scenarioId)
    const assets = await this.mediaAssetRepository.listByScenario(scenarioId)
    return assets.map(toMediaAssetSummary)
  }
}

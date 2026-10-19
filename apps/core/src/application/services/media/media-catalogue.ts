import type { GameMasterMediaCatalogueEntry } from '../../../domain/game-master/game-master.types.js'
import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'
import type { IMediaAssetRepository } from '../../ports/IMediaAssetRepository.js'

/** Bounds the catalogue that enters every GM prompt. */
export const GM_MEDIA_CATALOGUE_LIMITS = { maxEntries: 20, descriptionMaxLength: 300 } as const

/**
 * The scenario's cue-able assets the GM may still cue in this session: an asset already cued
 * (by any trigger) is left out, so it plays at most once per session.
 */
export async function loadGameMasterMediaCatalogue(
  mediaAssetRepository: IMediaAssetRepository,
  eventLogRepository: IEventLogRepository | undefined,
  scenarioId: string,
  sessionId: string,
): Promise<GameMasterMediaCatalogueEntry[]> {
  const assets = (await mediaAssetRepository.listByScenario(scenarioId)).filter(
    (asset) => asset.cueable,
  )
  if (assets.length === 0) return []
  const cued = new Set(
    (await eventLogRepository?.findBySessionId(sessionId, { type: 'media.cue_emitted' }))?.map(
      (event) => event.payload['assetId'],
    ) ?? [],
  )
  return assets
    .filter((asset) => !cued.has(asset.assetId))
    .slice(0, GM_MEDIA_CATALOGUE_LIMITS.maxEntries)
    .map((asset) => ({
      assetId: asset.assetId,
      kind: asset.kind,
      description: truncate(asset.description, GM_MEDIA_CATALOGUE_LIMITS.descriptionMaxLength),
    }))
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`
}

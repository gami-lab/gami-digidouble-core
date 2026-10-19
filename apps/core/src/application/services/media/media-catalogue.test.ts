import { describe, expect, it } from 'vitest'
import { InMemoryEventLogRepository } from '../../../infrastructure/db/in-memory-event-log.repository.js'
import { InMemoryMediaAssetRepository } from '../../../infrastructure/db/in-memory-media-asset.repository.js'
import { makeMediaAsset } from '../../../test-utils/media.js'
import { GM_MEDIA_CATALOGUE_LIMITS, loadGameMasterMediaCatalogue } from './media-catalogue.js'

describe('loadGameMasterMediaCatalogue', () => {
  it('offers cue-able assets of the scenario that were not cued yet in the session', async () => {
    const eventLog = new InMemoryEventLogRepository()
    await eventLog.append({
      sessionId: 'session_1',
      type: 'media.cue_emitted',
      severity: 'info',
      payload: { assetId: 'media_cued' },
    })
    const repository = new InMemoryMediaAssetRepository([
      makeMediaAsset({ assetId: 'media_chalet', cueable: true, description: 'The chalet' }),
      makeMediaAsset({ assetId: 'media_cued', cueable: true }),
      makeMediaAsset({ assetId: 'media_private', cueable: false }),
      makeMediaAsset({ assetId: 'media_other', cueable: true, scenarioId: 'scenario_2' }),
    ])

    await expect(
      loadGameMasterMediaCatalogue(repository, eventLog, 'scenario_1', 'session_1'),
    ).resolves.toEqual([{ assetId: 'media_chalet', kind: 'image', description: 'The chalet' }])
  })

  it('bounds the number of entries and the description length', async () => {
    const repository = new InMemoryMediaAssetRepository(
      Array.from({ length: GM_MEDIA_CATALOGUE_LIMITS.maxEntries + 5 }, (_, index) =>
        makeMediaAsset({
          assetId: `media_${String(index)}`,
          cueable: true,
          description: 'x'.repeat(GM_MEDIA_CATALOGUE_LIMITS.descriptionMaxLength + 50),
        }),
      ),
    )

    const catalogue = await loadGameMasterMediaCatalogue(
      repository,
      undefined,
      'scenario_1',
      'session_1',
    )

    expect(catalogue).toHaveLength(GM_MEDIA_CATALOGUE_LIMITS.maxEntries)
    expect(catalogue[0]?.description).toHaveLength(GM_MEDIA_CATALOGUE_LIMITS.descriptionMaxLength)
  })
})

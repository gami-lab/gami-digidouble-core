import { describe, expect, it, vi } from 'vitest'
import type { RuntimeEvent } from '@gami/shared'
import { InMemoryEventLogRepository } from '../../../infrastructure/db/in-memory-event-log.repository.js'
import { InMemoryMediaAssetRepository } from '../../../infrastructure/db/in-memory-media-asset.repository.js'
import { InMemorySessionEventPublisher } from '../../../infrastructure/events/in-memory-session-event-publisher.js'
import { makeMediaAsset } from '../../../test-utils/media.js'
import { deriveMediaCueId, MediaCueService } from './media-cue.service.js'

function setup() {
  const eventLog = new InMemoryEventLogRepository()
  const publisher = new InMemorySessionEventPublisher()
  const events: RuntimeEvent[] = []
  publisher.subscribe('session_1', (event) => {
    events.push(event)
  })
  const service = new MediaCueService(
    new InMemoryMediaAssetRepository([
      makeMediaAsset({ assetId: 'media_reveal', kind: 'video', mimeType: 'video/mp4' }),
      makeMediaAsset({ assetId: 'media_map', description: 'The harbor map' }),
      makeMediaAsset({ assetId: 'media_foreign', scenarioId: 'scenario_2' }),
    ]),
    eventLog,
    publisher,
  )
  return { service, eventLog, events }
}

const request = {
  sessionId: 'session_1',
  scenarioId: 'scenario_1',
  origin: 'avatar_unlocked' as const,
  triggerKey: 'unlock:session_1:avatar_2',
}

describe('MediaCueService', () => {
  it('records the cue, then publishes the player projection with a display by kind', async () => {
    const { service, eventLog, events } = setup()

    await service.emit({ ...request, assetId: 'media_reveal' })
    await service.emit({ ...request, assetId: 'media_map', triggerKey: 'other' })

    expect(events[0]?.payload).toMatchObject({
      cueId: deriveMediaCueId(request.triggerKey, 'media_reveal'),
      asset: { assetId: 'media_reveal', kind: 'video' },
      origin: 'avatar_unlocked',
      display: 'fullscreen',
    })
    expect(events[1]?.payload).toMatchObject({ display: 'overlay' })
    expect(eventLog.getAll()[0]).toMatchObject({
      type: 'media.cue_emitted',
      payload: { origin: 'avatar_unlocked', assetId: 'media_reveal', kind: 'video' },
    })
    expect(JSON.stringify(eventLog.getAll())).not.toContain('/v1/media')
  })

  it('emits once per triggering event even when the trigger repeats', async () => {
    const { service, eventLog, events } = setup()

    await service.emit({ ...request, assetId: 'media_reveal' })
    await service.emit({ ...request, assetId: 'media_reveal' })

    expect(events).toHaveLength(1)
    expect(eventLog.getAll()).toHaveLength(1)
  })

  it('derives a stable cue id from the trigger and the asset', () => {
    expect(deriveMediaCueId('a', 'media_x')).toBe(deriveMediaCueId('a', 'media_x'))
    expect(deriveMediaCueId('a', 'media_x')).not.toBe(deriveMediaCueId('b', 'media_x'))
    expect(deriveMediaCueId('a', 'media_x')).toMatch(/^cue_[0-9a-f]{32}$/)
  })

  it.each(['media_missing', 'media_foreign'])(
    'skips %s with a bounded diagnostic and publishes nothing',
    async (assetId) => {
      const { service, eventLog, events } = setup()

      await service.emit({ ...request, assetId })

      expect(events).toEqual([])
      expect(eventLog.getAll()).toEqual([
        expect.objectContaining({
          type: 'media.cue_skipped',
          payload: { origin: 'avatar_unlocked', assetId, reason: 'asset_not_found' },
        }),
      ])
    },
  )

  it('never throws when storage of the cue fails', async () => {
    const eventLog = new InMemoryEventLogRepository()
    vi.spyOn(eventLog, 'appendOnce').mockRejectedValue(new Error('db down'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const service = new MediaCueService(
      new InMemoryMediaAssetRepository([makeMediaAsset({ assetId: 'media_map' })]),
      eventLog,
      new InMemorySessionEventPublisher(),
    )

    await expect(service.emit({ ...request, assetId: 'media_map' })).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

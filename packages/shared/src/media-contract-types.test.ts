import { describe, expect, it } from 'vitest'
import {
  isAvatarMediaTriggers,
  isMediaCuePayload,
  MEDIA_KINDS,
  MEDIA_LIMITS,
  MEDIA_MIME_TYPES,
  isMediaKind,
  isMediaRef,
  mediaKindForMimeType,
} from './media-contract-types.js'

describe('media contract', () => {
  it('accepts only prefixed asset ids as media refs', () => {
    expect(isMediaRef('media_3f1c2a9e-0b7d-4c1e-9a55-2b8d6f0e4a11')).toBe(true)
    expect(isMediaRef('https://cdn.example.com/cover.jpg')).toBe(false)
    expect(isMediaRef('scenario_1')).toBe(false)
    expect(isMediaRef('media_')).toBe(false)
    expect(isMediaRef('media_a/../b')).toBe(false)
    expect(isMediaRef(42)).toBe(false)
  })

  it('maps allowed MIME types to their kind and rejects everything else', () => {
    expect(mediaKindForMimeType('image/jpeg')).toBe('image')
    expect(mediaKindForMimeType('IMAGE/PNG')).toBe('image')
    expect(mediaKindForMimeType('video/mp4; codecs="avc1"')).toBe('video')
    expect(mediaKindForMimeType('image/svg+xml')).toBeNull()
    expect(mediaKindForMimeType('video/quicktime')).toBeNull()
    expect(mediaKindForMimeType('')).toBeNull()
  })

  it('defines an upload limit and MIME list for every kind', () => {
    for (const kind of MEDIA_KINDS) {
      expect(isMediaKind(kind)).toBe(true)
      expect(MEDIA_LIMITS.maxUploadBytes[kind]).toBeGreaterThan(0)
      expect(MEDIA_MIME_TYPES[kind].length).toBeGreaterThan(0)
    }
    expect(MEDIA_LIMITS.maxUploadBytes.video).toBeGreaterThan(MEDIA_LIMITS.maxUploadBytes.image)
    expect(isMediaKind('audio')).toBe(false)
  })
})

describe('avatar media triggers', () => {
  it('accepts unlock and switch refs only', () => {
    expect(isAvatarMediaTriggers({ onUnlock: 'media_reveal', onSwitchTo: 'media_cut' })).toBe(true)
    expect(isAvatarMediaTriggers({})).toBe(true)
    expect(isAvatarMediaTriggers({ onEnter: 'media_x' })).toBe(false)
    expect(isAvatarMediaTriggers({ onUnlock: 'https://cdn.example.com/a.mp4' })).toBe(false)
    expect(isAvatarMediaTriggers(null)).toBe(false)
    expect(isAvatarMediaTriggers(['media_x'])).toBe(false)
  })
})

describe('media cue payload', () => {
  const asset = { assetId: 'media_a', kind: 'video', url: '/v1/media/media_a', description: 'A' }

  it('accepts the runtime cue shape and rejects anything else', () => {
    expect(
      isMediaCuePayload({ cueId: 'cue_1', asset, origin: 'game_master', display: 'fullscreen' }),
    ).toBe(true)
    expect(isMediaCuePayload({ cueId: 'cue_1', asset, origin: 'user', display: 'overlay' })).toBe(
      false,
    )
    expect(
      isMediaCuePayload({
        cueId: 'cue_1',
        asset: { ...asset, kind: 'audio' },
        origin: 'game_master',
        display: 'overlay',
      }),
    ).toBe(false)
    expect(isMediaCuePayload(null)).toBe(false)
  })
})

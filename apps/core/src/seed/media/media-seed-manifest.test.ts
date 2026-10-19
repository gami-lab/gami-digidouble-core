import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  findExistingAsset,
  mergeSlots,
  validateMediaSeedManifest,
  type MediaSeedManifest,
} from './media-seed-manifest.js'

const manifest: MediaSeedManifest = {
  assets: [
    { key: 'poster', url: 'https://cdn.test/p.jpg', mimeType: 'image/jpeg', description: 'Poster' },
    {
      key: 'intro',
      file: 'intro.mp4',
      mimeType: 'video/mp4',
      description: 'Intro',
      poster: 'poster',
    },
  ],
  scenario: { introMedia: 'intro' },
  avatars: { Max: { mediaTriggers: { onUnlock: 'intro' } } },
}

describe('media seed manifest', () => {
  it('accepts a consistent manifest and the checked-in AVA manifest', () => {
    expect(() => {
      validateMediaSeedManifest(manifest)
    }).not.toThrow()
    const ava = JSON.parse(
      readFileSync(new URL('./ava.media.json', import.meta.url), 'utf8'),
    ) as MediaSeedManifest
    expect(() => {
      validateMediaSeedManifest(ava)
    }).not.toThrow()
    expect(ava.scenario?.introMedia).toBeDefined()
    expect(ava.assets.some((asset) => asset.cueable === true)).toBe(true)
  })

  it.each([
    ['an unknown slot key', { ...manifest, scenario: { cover: 'missing' } }],
    ['a poster listed after its video', { ...manifest, assets: [...manifest.assets].reverse() }],
    [
      'an unsupported type',
      { assets: [{ key: 'a', url: 'https://x', mimeType: 'image/gif', description: 'A' }] },
    ],
  ])('rejects %s', (_label, invalid) => {
    expect(() => {
      validateMediaSeedManifest(invalid as MediaSeedManifest)
    }).toThrow()
  })

  it('merges resolved ids over existing slots and reuses assets by description', () => {
    const ids = new Map([['intro', 'media_1']])

    expect(mergeSlots({ tagline: 'Kept', cover: 'media_0' }, { introMedia: 'intro' }, ids)).toEqual(
      { tagline: 'Kept', cover: 'media_0', introMedia: 'media_1' },
    )
    expect(
      findExistingAsset(
        [{ assetId: 'media_9', description: 'Intro' } as never],
        manifest.assets[1] as MediaSeedManifest['assets'][number],
      ),
    ).toMatchObject({ assetId: 'media_9' })
  })
})

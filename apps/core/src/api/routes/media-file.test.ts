import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import type { Scenario } from '../../domain/scenario/scenario.types.js'
import { InMemoryMediaAssetRepository } from '../../infrastructure/db/in-memory-media-asset.repository.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemoryMediaStorage } from '../../infrastructure/media/in-memory-media-storage.js'
import { makeMediaAsset } from '../../test-utils/media.js'
import { createServer } from '../server.js'
import { parseRange } from './media-file.js'
import { TEST_CONFIG } from './test-config.js'

const FILE = Buffer.from('0123456789')

function makeScenario(scenarioId: string, status: Scenario['status']): Scenario {
  return {
    scenarioId,
    name: scenarioId,
    status,
    language: 'en',
    objectives: [],
    worldContext: '',
    avatarAvailability: { initialAvatarIds: [] },
    config: {},
    createdAt: '2026-10-19T10:00:00.000Z',
    updatedAt: '2026-10-19T10:00:00.000Z',
  }
}

async function makeApp() {
  const storage = new InMemoryMediaStorage()
  await storage.put('active-file', Readable.from([FILE]))
  await storage.put('draft-file', Readable.from([FILE]))
  return createServer(TEST_CONFIG, {
    scenarioRepository: new InMemoryScenarioRepository([
      makeScenario('scenario_1', 'active'),
      makeScenario('scenario_draft', 'draft'),
    ]),
    mediaAssetRepository: new InMemoryMediaAssetRepository([
      makeMediaAsset({ assetId: 'media_active-file', byteSize: FILE.byteLength }),
      makeMediaAsset({ assetId: 'media_draft-file', scenarioId: 'scenario_draft' }),
      makeMediaAsset({ assetId: 'media_missing-file' }),
      makeMediaAsset({
        assetId: 'media_url',
        source: 'url',
        storageKey: null,
        url: 'https://cdn.example.com/a.png',
      }),
    ]),
    mediaStorage: storage,
  })
}

describe('open media file route', () => {
  it('serves an active-scenario upload without a credential, with cache headers', async () => {
    const app = await makeApp()

    const response = await app.inject({ method: 'GET', url: '/v1/media/media_active-file' })

    expect(response.statusCode).toBe(200)
    expect(response.body).toBe('0123456789')
    expect(response.headers).toMatchObject({
      'content-type': 'image/png',
      'content-length': '10',
      'accept-ranges': 'bytes',
      'cache-control': 'public, max-age=3600',
      etag: '"media_active-file"',
      'x-content-type-options': 'nosniff',
    })
  })

  it('serves one byte range with 206', async () => {
    const app = await makeApp()

    const response = await app.inject({
      method: 'GET',
      url: '/v1/media/media_active-file',
      headers: { range: 'bytes=2-5' },
    })

    expect(response.statusCode).toBe(206)
    expect(response.body).toBe('2345')
    expect(response.headers['content-range']).toBe('bytes 2-5/10')
    expect(response.headers['content-length']).toBe('4')
  })

  it('answers 416 for a range outside the file and 304 for a matching ETag', async () => {
    const app = await makeApp()

    const outside = await app.inject({
      method: 'GET',
      url: '/v1/media/media_active-file',
      headers: { range: 'bytes=20-30' },
    })
    const cached = await app.inject({
      method: 'GET',
      url: '/v1/media/media_active-file',
      headers: { 'if-none-match': '"media_active-file"' },
    })

    expect(outside.statusCode).toBe(416)
    expect(outside.headers['content-range']).toBe('bytes */10')
    expect(cached.statusCode).toBe(304)
  })

  it.each([
    ['an unknown asset', 'media_unknown'],
    ['an asset of an inactive scenario', 'media_draft-file'],
    ['an asset whose file is missing', 'media_missing-file'],
    ['a URL asset', 'media_url'],
  ])('returns 404 for %s', async (_label, assetId) => {
    const app = await makeApp()

    const response = await app.inject({ method: 'GET', url: `/v1/media/${assetId}` })

    expect(response.statusCode).toBe(404)
  })
})

describe('parseRange', () => {
  it.each([
    [undefined, undefined],
    ['bytes=0-', { start: 0, end: 9 }],
    ['bytes=4-100', { start: 4, end: 9 }],
    ['bytes=-3', { start: 7, end: 9 }],
    ['bytes=-30', { start: 0, end: 9 }],
    ['bytes=0-1,4-5', undefined],
    ['items=0-1', undefined],
    ['bytes=-', undefined],
    ['bytes=10-', 'unsatisfiable'],
    ['bytes=5-2', 'unsatisfiable'],
    ['bytes=-0', 'unsatisfiable'],
  ] as const)('%s', (header, expected) => {
    expect(parseRange(header, 10)).toEqual(expected)
  })
})

import { describe, expect, it } from 'vitest'
import type {
  ApiResponse,
  ListMediaAssetsResponse,
  MediaAssetResponse,
  MediaAssetSummary,
} from '@gami/shared'
import type { Scenario } from '../../domain/scenario/scenario.types.js'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryMediaAssetRepository } from '../../infrastructure/db/in-memory-media-asset.repository.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemoryMediaStorage } from '../../infrastructure/media/in-memory-media-storage.js'
import { MP4_BYTES, PNG_BYTES } from '../../test-utils/media.js'
import { createServer } from '../server.js'
import { playerHeaders, serviceKeyHeaders } from './test-auth.js'
import { TEST_CONFIG } from './test-config.js'

const scenario: Scenario = {
  scenarioId: 'scenario_1',
  name: 'House',
  status: 'active',
  language: 'en',
  objectives: [],
  worldContext: '',
  avatarAvailability: { initialAvatarIds: [] },
  config: {},
  createdAt: '2026-10-19T10:00:00.000Z',
  updatedAt: '2026-10-19T10:00:00.000Z',
}

function makeApp() {
  const storage = new InMemoryMediaStorage()
  const scenarios = new InMemoryScenarioRepository([scenario])
  const app = createServer(TEST_CONFIG, {
    scenarioRepository: scenarios,
    avatarRepository: new InMemoryAvatarRepository(),
    mediaAssetRepository: new InMemoryMediaAssetRepository(),
    mediaStorage: storage,
  })
  return { app, storage, scenarios }
}

type App = ReturnType<typeof makeApp>['app']

async function upload(
  app: App,
  body: Uint8Array,
  contentType: string,
  query = 'description=The%20house%20at%20night',
) {
  return app.inject({
    method: 'POST',
    url: `/v1/admin/scenarios/scenario_1/media/upload?${query}`,
    headers: { ...serviceKeyHeaders(), 'content-type': contentType },
    payload: Buffer.from(body),
  })
}

async function uploadAsset(app: App, body = PNG_BYTES, type = 'image/png') {
  const response = await upload(app, body, type)
  expect(response.statusCode).toBe(201)
  return response.json<ApiResponse<MediaAssetResponse>>().data?.asset as MediaAssetSummary
}

describe('admin media upload', () => {
  it('stores an uploaded image and returns its admin projection', async () => {
    const { app, storage } = makeApp()

    const asset = await uploadAsset(app)

    expect(asset).toMatchObject({
      scenarioId: 'scenario_1',
      kind: 'image',
      source: 'upload',
      mimeType: 'image/png',
      byteSize: PNG_BYTES.byteLength,
      url: null,
      fileUrl: `/v1/media/${asset.assetId}`,
      description: 'The house at night',
      cueable: false,
    })
    expect(storage.has(asset.assetId.replace('media_', ''))).toBe(true)
    expect(JSON.stringify(asset)).not.toContain('storageKey')
  })

  it('reads cueable, duration, and poster from the query', async () => {
    const { app } = makeApp()
    const poster = await uploadAsset(app)

    const response = await upload(
      app,
      MP4_BYTES,
      'video/mp4',
      `description=Arrival&cueable=true&durationMs=12000&posterAssetId=${poster.assetId}`,
    )

    expect(response.statusCode).toBe(201)
    expect(response.json<ApiResponse<MediaAssetResponse>>().data?.asset).toMatchObject({
      kind: 'video',
      cueable: true,
      durationMs: 12000,
      posterAssetId: poster.assetId,
    })
  })

  it.each([
    ['an unsupported type', PNG_BYTES, 'image/svg+xml', 'description=x'],
    ['content that does not match its type', PNG_BYTES, 'video/mp4', 'description=x'],
    ['a missing description', PNG_BYTES, 'image/png', 'cueable=true'],
    ['a blank description', PNG_BYTES, 'image/png', 'description=%20%20'],
    ['an unknown query field', PNG_BYTES, 'image/png', 'description=x&filename=a.png'],
    ['a poster that does not exist', MP4_BYTES, 'video/mp4', 'description=x&posterAssetId=media_x'],
  ])('rejects %s with 400', async (_label, body, type, query) => {
    const { app } = makeApp()

    const response = await upload(app, body, type, query)

    expect(response.statusCode).toBe(400)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('VALIDATION_ERROR')
  })

  it('rejects a declared size over the kind limit before reading the body', async () => {
    const { app } = makeApp()

    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/scenarios/scenario_1/media/upload?description=Big',
      headers: {
        ...serviceKeyHeaders(),
        'content-type': 'image/png',
        'content-length': String(11 * 1024 * 1024),
      },
      payload: Buffer.from(PNG_BYTES),
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 404 for an unknown scenario', async () => {
    const { app } = makeApp()

    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/scenarios/scenario_missing/media/upload?description=x',
      headers: { ...serviceKeyHeaders(), 'content-type': 'image/png' },
      payload: Buffer.from(PNG_BYTES),
    })

    expect(response.statusCode).toBe(404)
  })

  it('requires an admin credential', async () => {
    const { app } = makeApp()
    const url = '/v1/admin/scenarios/scenario_1/media/upload?description=x'

    const anonymous = await app.inject({ method: 'POST', url, payload: Buffer.from(PNG_BYTES) })
    const player = await app.inject({
      method: 'POST',
      url,
      headers: { ...playerHeaders(), 'content-type': 'image/png' },
      payload: Buffer.from(PNG_BYTES),
    })

    expect(anonymous.statusCode).toBe(401)
    expect(player.statusCode).toBe(403)
  })
})

describe('admin media library', () => {
  it('creates URL assets, lists them, and updates their metadata', async () => {
    const { app } = makeApp()
    const created = await app.inject({
      method: 'POST',
      url: '/v1/admin/scenarios/scenario_1/media',
      headers: serviceKeyHeaders(),
      payload: {
        url: 'https://cdn.example.com/intro.mp4',
        mimeType: 'video/mp4',
        description: 'The intro film',
        durationMs: 30000,
      },
    })
    expect(created.statusCode).toBe(201)
    const asset = created.json<ApiResponse<MediaAssetResponse>>().data?.asset
    expect(asset).toMatchObject({
      kind: 'video',
      source: 'url',
      url: 'https://cdn.example.com/intro.mp4',
      fileUrl: 'https://cdn.example.com/intro.mp4',
      byteSize: null,
    })

    const patched = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/media/${asset?.assetId ?? ''}`,
      headers: serviceKeyHeaders(),
      payload: { cueable: true, durationMs: null, description: ' Updated ' },
    })
    expect(patched.json<ApiResponse<MediaAssetResponse>>().data?.asset).toMatchObject({
      cueable: true,
      durationMs: null,
      description: 'Updated',
    })

    const listed = await app.inject({
      method: 'GET',
      url: '/v1/admin/scenarios/scenario_1/media',
      headers: serviceKeyHeaders(),
    })
    expect(listed.json<ApiResponse<ListMediaAssetsResponse>>().data?.assets).toHaveLength(1)
  })

  it.each([
    ['a non-http URL', { url: 'ftp://x/a.png', mimeType: 'image/png', description: 'x' }],
    ['a disallowed type', { url: 'https://x/a.gif', mimeType: 'image/gif', description: 'x' }],
    [
      'a negative duration',
      { url: 'https://x/a.png', mimeType: 'image/png', description: 'x', durationMs: -1 },
    ],
  ])('rejects %s with 400', async (_label, payload) => {
    const { app } = makeApp()

    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/scenarios/scenario_1/media',
      headers: serviceKeyHeaders(),
      payload,
    })

    expect(response.statusCode).toBe(400)
  })

  it('rejects a video poster and a poster pointing at the asset itself', async () => {
    const { app } = makeApp()
    const video = await uploadAsset(app, MP4_BYTES, 'video/mp4')
    const image = await uploadAsset(app)

    const videoPoster = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/media/${image.assetId}`,
      headers: serviceKeyHeaders(),
      payload: { posterAssetId: video.assetId },
    })
    const selfPoster = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/media/${image.assetId}`,
      headers: serviceKeyHeaders(),
      payload: { posterAssetId: image.assetId },
    })

    expect(videoPoster.statusCode).toBe(400)
    expect(selfPoster.statusCode).toBe(400)
  })

  it('returns 404 when listing an unknown scenario or patching an unknown asset', async () => {
    const { app } = makeApp()

    const list = await app.inject({
      method: 'GET',
      url: '/v1/admin/scenarios/scenario_missing/media',
      headers: serviceKeyHeaders(),
    })
    const patch = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/media/media_missing',
      headers: serviceKeyHeaders(),
      payload: { cueable: true },
    })

    expect(list.statusCode).toBe(404)
    expect(patch.statusCode).toBe(404)
  })
})

describe('admin media deletion', () => {
  it('deletes an unused asset and its stored file', async () => {
    const { app, storage } = makeApp()
    const asset = await uploadAsset(app)

    const response = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/media/${asset.assetId}`,
      headers: serviceKeyHeaders(),
    })

    expect(response.statusCode).toBe(200)
    expect(storage.has(asset.assetId.replace('media_', ''))).toBe(false)
  })

  it('refuses with 409 while a presentation slot or a poster references the asset', async () => {
    const { app } = makeApp()
    const cover = await uploadAsset(app)
    await app.inject({
      method: 'PATCH',
      url: '/v1/admin/scenarios/scenario_1',
      headers: serviceKeyHeaders(),
      payload: { presentation: { cover: cover.assetId } },
    })
    const poster = await uploadAsset(app)
    await upload(app, MP4_BYTES, 'video/mp4', `description=x&posterAssetId=${poster.assetId}`)

    const coverDelete = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/media/${cover.assetId}`,
      headers: serviceKeyHeaders(),
    })
    const posterDelete = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/media/${poster.assetId}`,
      headers: serviceKeyHeaders(),
    })

    expect(coverDelete.statusCode).toBe(409)
    expect(coverDelete.json<ApiResponse<null>>().error?.details).toEqual({
      usages: ['scenario cover'],
    })
    expect(posterDelete.statusCode).toBe(409)
  })
})

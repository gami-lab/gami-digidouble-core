import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  MEDIA_LIMITS,
  type ApiResponse,
  type CreateScenarioResponse,
  type ListMediaAssetsResponse,
  type MediaAssetResponse,
} from '@gami/shared'
import { PNG_BYTES } from '../../test-utils/media.js'
import { STACK_SERVICE_KEY, stackPlayerHeaders } from './stack-e2e-auth.js'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const ADMIN = { 'x-admin-service-key': STACK_SERVICE_KEY }

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${APP_URL}${path}`, init)
}

async function uploadPng(
  scenarioId: string,
  headers: Record<string, string> = ADMIN,
  body: Uint8Array = PNG_BYTES,
  type = 'image/png',
): Promise<Response> {
  return call(`/v1/admin/scenarios/${scenarioId}/media/upload?description=Stack%20image`, {
    method: 'POST',
    headers: { ...headers, 'content-type': type },
    body,
  })
}

describe('Stack E2E — admin media', () => {
  let scenarioId = ''

  beforeAll(async () => {
    const response = await call('/v1/admin/scenarios', {
      method: 'POST',
      headers: { ...ADMIN, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Admin media stack scenario' }),
    })
    scenarioId =
      ((await response.json()) as ApiResponse<CreateScenarioResponse>).data?.scenario.scenarioId ??
      ''
  })

  afterAll(async () => {
    await call(`/v1/admin/scenarios/${scenarioId}`, { method: 'DELETE', headers: ADMIN })
  })

  it('returns 401 without an admin credential and 403 with a player token', async () => {
    expect((await uploadPng(scenarioId, {})).status).toBe(401)
    expect((await uploadPng(scenarioId, stackPlayerHeaders())).status).toBe(403)
    const list = await call(`/v1/admin/scenarios/${scenarioId}/media`, {
      headers: stackPlayerHeaders(),
    })
    expect(list.status).toBe(403)
  })

  it('returns 400 for an unsupported type, mismatching content, and an oversized file', async () => {
    expect((await uploadPng(scenarioId, ADMIN, PNG_BYTES, 'image/gif')).status).toBe(400)
    expect((await uploadPng(scenarioId, ADMIN, PNG_BYTES, 'video/webm')).status).toBe(400)
    const oversized = new Uint8Array(MEDIA_LIMITS.maxUploadBytes.image + 1)
    oversized.set(PNG_BYTES)
    expect((await uploadPng(scenarioId, ADMIN, oversized)).status).toBe(400)
  })

  it('returns 400 for invalid URL-asset metadata', async () => {
    const response = await call(`/v1/admin/scenarios/${scenarioId}/media`, {
      method: 'POST',
      headers: { ...ADMIN, 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'not-a-url', mimeType: 'image/png', description: '' }),
    })
    expect(response.status).toBe(400)
  })

  it('returns 404 for an unknown scenario or asset', async () => {
    expect((await uploadPng('scenario_00000000-0000-4000-8000-000000000000')).status).toBe(404)
    const patch = await call('/v1/admin/media/media_00000000-0000-4000-8000-000000000000', {
      method: 'PATCH',
      headers: { ...ADMIN, 'content-type': 'application/json' },
      body: JSON.stringify({ cueable: true }),
    })
    expect(patch.status).toBe(404)
  })

  it('uploads, lists, and deletes an image', async () => {
    const uploaded = await uploadPng(scenarioId)
    expect(uploaded.status).toBe(201)
    const asset = ((await uploaded.json()) as ApiResponse<MediaAssetResponse>).data?.asset
    expect(asset).toMatchObject({ kind: 'image', byteSize: PNG_BYTES.byteLength })

    const list = await call(`/v1/admin/scenarios/${scenarioId}/media`, { headers: ADMIN })
    const assets = ((await list.json()) as ApiResponse<ListMediaAssetsResponse>).data?.assets
    expect(assets?.map((item) => item.assetId)).toContain(asset?.assetId)

    const removed = await call(`/v1/admin/media/${asset?.assetId ?? ''}`, {
      method: 'DELETE',
      headers: ADMIN,
    })
    expect(removed.status).toBe(200)
  })
})

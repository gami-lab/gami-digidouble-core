import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ApiResponse, CreateScenarioResponse, MediaAssetResponse } from '@gami/shared'
import { PNG_BYTES } from '../../test-utils/media.js'
import { STACK_SERVICE_KEY } from './stack-e2e-auth.js'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const ADMIN = { 'x-admin-service-key': STACK_SERVICE_KEY }

async function createScenario(status: 'draft' | 'active'): Promise<string> {
  const response = await fetch(`${APP_URL}/v1/admin/scenarios`, {
    method: 'POST',
    headers: { ...ADMIN, 'content-type': 'application/json' },
    body: JSON.stringify({ name: `Media file ${status}`, status, language: 'en' }),
  })
  return ((await response.json()) as ApiResponse<CreateScenarioResponse>).data?.scenario
    .scenarioId as string
}

async function upload(scenarioId: string): Promise<string> {
  const response = await fetch(
    `${APP_URL}/v1/admin/scenarios/${scenarioId}/media/upload?description=Served%20image`,
    { method: 'POST', headers: { ...ADMIN, 'content-type': 'image/png' }, body: PNG_BYTES },
  )
  return ((await response.json()) as ApiResponse<MediaAssetResponse>).data?.asset.assetId as string
}

describe('Stack E2E — open media file route', () => {
  const scenarios: string[] = []
  let activeAsset = ''
  let draftAsset = ''

  beforeAll(async () => {
    const active = await createScenario('active')
    const draft = await createScenario('draft')
    scenarios.push(active, draft)
    activeAsset = await upload(active)
    draftAsset = await upload(draft)
  })

  afterAll(async () => {
    for (const scenarioId of scenarios) {
      await fetch(`${APP_URL}/v1/admin/scenarios/${scenarioId}`, {
        method: 'DELETE',
        headers: ADMIN,
      })
    }
  })

  it('returns 404 for an unknown asset and for an asset of an inactive scenario', async () => {
    const unknown = await fetch(`${APP_URL}/v1/media/media_00000000-0000-4000-8000-000000000000`)
    const inactive = await fetch(`${APP_URL}/v1/media/${draftAsset}`)

    expect(unknown.status).toBe(404)
    expect(inactive.status).toBe(404)
  })

  it('serves the file with 200 and a byte range with 206, without a credential', async () => {
    const full = await fetch(`${APP_URL}/v1/media/${activeAsset}`)
    const partial = await fetch(`${APP_URL}/v1/media/${activeAsset}`, {
      headers: { range: 'bytes=1-3' },
    })

    expect(full.status).toBe(200)
    expect(full.headers.get('content-type')).toBe('image/png')
    expect(new Uint8Array(await full.arrayBuffer())).toEqual(PNG_BYTES)
    expect(partial.status).toBe(206)
    expect(partial.headers.get('content-range')).toBe(`bytes 1-3/${String(PNG_BYTES.byteLength)}`)
    expect(new Uint8Array(await partial.arrayBuffer())).toEqual(PNG_BYTES.subarray(1, 4))
  })
})

/** Requires APP_URL to point to a running stack with a real LLM provider for trait preparation. */
import http from 'node:http'
import { URL } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type {
  ApiResponse,
  CreateAvatarResponse,
  CreateScenarioResponse,
  MediaAssetResponse,
  StartSessionResponse,
} from '@gami/shared'
import { STACK_SERVICE_KEY, stackPlayerHeaders } from './stack-e2e-auth.js'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const isNullProvider = (process.env['LLM_PROVIDER'] ?? 'null') === 'null'
const ADMIN = { 'x-admin-service-key': STACK_SERVICE_KEY, 'content-type': 'application/json' }

async function call<T>(
  path: string,
  method: string,
  body?: unknown,
  headers: Record<string, string> = ADMIN,
): Promise<T> {
  const response = await fetch(`${APP_URL}${path}`, {
    method,
    headers: body === undefined ? withoutContentType(headers) : headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const payload = (await response.json()) as ApiResponse<T>
  if (payload.error !== null) throw new Error(`${method} ${path}: ${payload.error.message}`)
  return payload.data
}

function withoutContentType(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).filter(([key]) => key !== 'content-type'))
}

/** Collects runtime event types from a session stream until stopped. */
function collectEvents(sessionId: string, userId: string): { types: string[]; stop: () => void } {
  const url = new URL(`/v1/sessions/${sessionId}/events/stream`, APP_URL)
  const types: string[] = []
  const request = http.get(
    {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: stackPlayerHeaders(userId),
    },
    (response) => {
      response.on('data', (chunk: Buffer) => {
        for (const match of chunk.toString('utf8').matchAll(/"type":"(runtime\.[a-z_]+)"/g)) {
          types.push(match[1] ?? '')
        }
      })
    },
  )
  request.on('error', () => undefined)
  return { types, stop: () => request.destroy() }
}

describe.skipIf(isNullProvider)('Stack E2E — runtime.media_cue on the events stream', () => {
  let scenarioId = ''
  const avatarIds: string[] = []
  const sessionIds: string[] = []

  beforeAll(async () => {
    const { scenario } = await call<CreateScenarioResponse>('/v1/admin/scenarios', 'POST', {
      name: `Media cue stack ${String(Date.now())}`,
      status: 'active',
      language: 'en',
    })
    scenarioId = scenario.scenarioId
    for (const name of ['Ava', 'Theo']) {
      const { avatar } = await call<CreateAvatarResponse>(
        `/v1/admin/scenarios/${scenarioId}/avatars`,
        'POST',
        { name, personaPrompt: `You are ${name}, a museum guide.` },
      )
      avatarIds.push(avatar.avatarId)
    }
    await call(`/v1/admin/scenarios/${scenarioId}/prepare-avatar-traits`, 'POST')
    const { asset } = await call<MediaAssetResponse>(
      `/v1/admin/scenarios/${scenarioId}/media`,
      'POST',
      {
        url: 'https://cdn.example.com/cut.png',
        mimeType: 'image/png',
        description: 'A cut to Theo',
      },
    )
    for (const avatarId of avatarIds) {
      await call(`/v1/admin/avatars/${avatarId}`, 'PATCH', {
        status: 'active',
        ...(avatarId === avatarIds[1] ? { mediaTriggers: { onSwitchTo: asset.assetId } } : {}),
      })
    }
    await call(`/v1/admin/scenarios/${scenarioId}`, 'PATCH', {
      avatarAvailability: { initialAvatarIds: avatarIds },
    })
  }, 120_000)

  afterAll(async () => {
    for (const sessionId of sessionIds) await call(`/v1/admin/sessions/${sessionId}`, 'DELETE')
    for (const avatarId of avatarIds) await call(`/v1/admin/avatars/${avatarId}`, 'DELETE')
    await call(`/v1/admin/scenarios/${scenarioId}`, 'DELETE').catch(() => undefined)
  })

  it('delivers the switch cue to the switching player only', async () => {
    const start = (userId: string) =>
      call<StartSessionResponse>(
        '/v1/sessions',
        'POST',
        { scenarioId },
        {
          ...stackPlayerHeaders(userId),
          'content-type': 'application/json',
        },
      )
    const mine = (await start('media_cue_player_a')).session.sessionId
    const theirs = (await start('media_cue_player_b')).session.sessionId
    sessionIds.push(mine, theirs)
    const myStream = collectEvents(mine, 'media_cue_player_a')
    const theirStream = collectEvents(theirs, 'media_cue_player_b')
    try {
      await new Promise((resolve) => setTimeout(resolve, 300))
      await call(
        `/v1/sessions/${mine}/switch-avatar`,
        'POST',
        { avatarId: avatarIds[1] },
        {
          ...stackPlayerHeaders('media_cue_player_a'),
          'content-type': 'application/json',
        },
      )
      await expect.poll(() => myStream.types, { timeout: 10_000 }).toContain('runtime.media_cue')
      expect(theirStream.types).not.toContain('runtime.media_cue')
    } finally {
      myStream.stop()
      theirStream.stop()
    }
  })
})

import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { ApiResponse, ListVoicesResponse } from '@gami/shared'
import {
  FAKE_DEFAULT_VOICE,
  FakeTextToSpeechAdapter,
} from '../../application/voice/test-support/fake-text-to-speech.adapter.js'
import { UnconfiguredTextToSpeechAdapter } from '../../infrastructure/speech/gradium-text-to-speech.adapter.js'
import { createServer } from '../server.js'
import { TEST_CONFIG } from './test-config.js'

const appsToClose: FastifyInstance[] = []

afterEach(async () => {
  await Promise.all(appsToClose.splice(0).map(async (app) => app.close()))
})

function createApp(adapters: Parameters<typeof createServer>[1] = {}): FastifyInstance {
  const app = createServer(TEST_CONFIG, adapters)
  appsToClose.push(app)
  return app
}

const headers = { 'x-api-key': 'test-secret' }

describe('GET /v1/admin/voices', () => {
  it('requires the API key', async () => {
    const response = await createApp().inject({ method: 'GET', url: '/v1/admin/voices' })

    expect(response.statusCode).toBe(401)
  })

  it('reports a disabled provider with no voices when text-to-speech is off', async () => {
    const response = await createApp().inject({ method: 'GET', url: '/v1/admin/voices', headers })

    expect(response.statusCode).toBe(200)
    expect(response.json<ApiResponse<ListVoicesResponse>>().data).toEqual({
      provider: null,
      voices: [],
    })
  })

  it('lists the active provider voices with the default for the requested language', async () => {
    const response = await createApp({ textToSpeechAdapter: new FakeTextToSpeechAdapter() }).inject(
      {
        method: 'GET',
        url: '/v1/admin/voices?language=en-US',
        headers,
      },
    )

    expect(response.statusCode).toBe(200)
    expect(response.json<ApiResponse<ListVoicesResponse>>().data).toEqual({
      provider: 'gradium',
      voices: [FAKE_DEFAULT_VOICE],
      defaultVoiceId: FAKE_DEFAULT_VOICE.voiceId,
    })
  })

  it('rejects an invalid language tag', async () => {
    const response = await createApp({ textToSpeechAdapter: new FakeTextToSpeechAdapter() }).inject(
      {
        method: 'GET',
        url: '/v1/admin/voices?language=en_US',
        headers,
      },
    )

    expect(response.statusCode).toBe(400)
  })

  it('surfaces missing provider credentials as a typed error', async () => {
    const response = await createApp({
      textToSpeechAdapter: new UnconfiguredTextToSpeechAdapter(),
    }).inject({ method: 'GET', url: '/v1/admin/voices', headers })

    expect(response.statusCode).toBeGreaterThanOrEqual(400)
    expect(response.json<ApiResponse<null>>().error?.message).toContain('missing_credentials')
  })
})

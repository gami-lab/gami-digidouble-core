import { afterEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { ApiResponse, ListVoicesResponse } from '@gami/shared'
import {
  FAKE_DEFAULT_VOICE,
  FakeTextToSpeechAdapter,
} from '../../application/voice/test-support/fake-text-to-speech.adapter.js'
import { TextToSpeechProviders } from '../../application/voice/text-to-speech-providers.js'
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

  it('reports no provider and no voices when no provider has credentials', async () => {
    const response = await createApp().inject({ method: 'GET', url: '/v1/admin/voices', headers })

    expect(response.statusCode).toBe(200)
    expect(response.json<ApiResponse<ListVoicesResponse>>().data).toEqual({
      defaultProvider: null,
      providers: [],
      provider: null,
      voices: [],
    })
  })

  it('lists the default provider voices with the default for the requested language', async () => {
    const response = await createApp({ textToSpeechProviders: withFakeProvider('gradium') }).inject(
      {
        method: 'GET',
        url: '/v1/admin/voices?language=en-US',
        headers,
      },
    )

    expect(response.statusCode).toBe(200)
    expect(response.json<ApiResponse<ListVoicesResponse>>().data).toEqual({
      defaultProvider: 'gradium',
      providers: ['gradium'],
      provider: 'gradium',
      voices: [FAKE_DEFAULT_VOICE],
      defaultVoiceId: FAKE_DEFAULT_VOICE.voiceId,
    })
  })

  it('lists a requested provider that has credentials even without a default provider', async () => {
    const response = await createApp({ textToSpeechProviders: withFakeProvider(null) }).inject({
      method: 'GET',
      url: '/v1/admin/voices?provider=gradium',
      headers,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json<ApiResponse<ListVoicesResponse>>().data).toMatchObject({
      defaultProvider: null,
      providers: ['gradium'],
      provider: 'gradium',
      voices: [FAKE_DEFAULT_VOICE],
    })
  })

  it('lists nothing for a requested provider without credentials', async () => {
    const response = await createApp().inject({
      method: 'GET',
      url: '/v1/admin/voices?provider=gradium',
      headers,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json<ApiResponse<ListVoicesResponse>>().data).toEqual({
      defaultProvider: null,
      providers: [],
      provider: null,
      voices: [],
    })
  })

  it('rejects an unknown provider and an invalid language', async () => {
    const app = createApp({ textToSpeechProviders: withFakeProvider('gradium') })
    for (const url of ['/v1/admin/voices?provider=acme', '/v1/admin/voices?language=en_US']) {
      const response = await app.inject({ method: 'GET', url, headers })
      expect(response.statusCode).toBe(400)
    }
  })
})

function withFakeProvider(defaultProvider: 'gradium' | null): TextToSpeechProviders {
  return new TextToSpeechProviders([new FakeTextToSpeechAdapter()], defaultProvider)
}

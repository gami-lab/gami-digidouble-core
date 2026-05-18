import { afterEach, describe, expect, it } from 'vitest'
import type { ApiResponse, ModelConfigResponse } from '@gami/shared'
import type { FastifyInstance } from 'fastify'
import { createServer } from '../server.js'
import { TEST_CONFIG } from './test-config.js'

const appsToClose: FastifyInstance[] = []

afterEach(async () => {
  await Promise.all(appsToClose.splice(0).map(async (app) => app.close()))
})

function makeApp(): FastifyInstance {
  const app = createServer(TEST_CONFIG)
  appsToClose.push(app)
  return app
}

function authHeaders(apiKey = 'test-secret'): { 'x-api-key': string } {
  return { 'x-api-key': apiKey }
}

describe('GET /v1/admin/model-config', () => {
  it('returns 401 when API key is missing', async () => {
    const response = await makeApp().inject({ method: 'GET', url: '/v1/admin/model-config' })

    expect(response.statusCode).toBe(401)
  })

  it('returns 401 when API key is wrong', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/v1/admin/model-config',
      headers: authHeaders('wrong-key'),
    })

    expect(response.statusCode).toBe(401)
  })

  it('returns 200 with effective default config when no row exists', async () => {
    const response = await makeApp().inject({
      method: 'GET',
      url: '/v1/admin/model-config',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ modelConfig: ModelConfigResponse }>>()
    expect(body.error).toBeNull()
    expect(body.data?.modelConfig.globalDefault.provider).toBe('null')
    expect(body.data?.modelConfig.globalDefault.model).toBe('')
  })
})

describe('PUT /v1/admin/model-config', () => {
  it('returns 401 when API key is missing', async () => {
    const response = await makeApp().inject({
      method: 'PUT',
      url: '/v1/admin/model-config',
      payload: {
        globalDefault: { provider: 'openai', model: 'gpt-4.1-mini' },
      },
    })

    expect(response.statusCode).toBe(401)
  })

  it('returns 400 VALIDATION_ERROR for invalid provider', async () => {
    const response = await makeApp().inject({
      method: 'PUT',
      url: '/v1/admin/model-config',
      headers: authHeaders(),
      payload: {
        globalDefault: { provider: 'invalid-provider', model: 'gpt-4.1-mini' },
      },
    })

    expect(response.statusCode).toBe(400)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 VALIDATION_ERROR for empty model', async () => {
    const response = await makeApp().inject({
      method: 'PUT',
      url: '/v1/admin/model-config',
      headers: authHeaders(),
      payload: {
        globalDefault: { provider: 'openai', model: '   ' },
      },
    })

    expect(response.statusCode).toBe(400)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })

  it('stores config and GET returns updated config', async () => {
    const app = makeApp()

    const putResponse = await app.inject({
      method: 'PUT',
      url: '/v1/admin/model-config',
      headers: authHeaders(),
      payload: {
        globalDefault: { provider: 'openai', model: 'gpt-4.1-mini' },
        roleOverrides: {
          gameMaster: { provider: 'anthropic', model: 'claude-3-7-sonnet' },
          avatar: { model: 'gpt-4.1' },
        },
      },
    })

    expect(putResponse.statusCode).toBe(200)
    const putBody = putResponse.json<ApiResponse<{ modelConfig: ModelConfigResponse }>>()
    expect(putBody.error).toBeNull()
    expect(putBody.data?.modelConfig.globalDefault.provider).toBe('openai')
    expect(putBody.data?.modelConfig.roleOverrides.gameMaster?.provider).toBe('anthropic')

    const getResponse = await app.inject({
      method: 'GET',
      url: '/v1/admin/model-config',
      headers: authHeaders(),
    })

    expect(getResponse.statusCode).toBe(200)
    const getBody = getResponse.json<ApiResponse<{ modelConfig: ModelConfigResponse }>>()
    expect(getBody.error).toBeNull()
    expect(getBody.data?.modelConfig).toEqual(putBody.data?.modelConfig)
  })
})

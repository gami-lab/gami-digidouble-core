import { afterEach, describe, expect, it } from 'vitest'
import type { ApiResponse, ModelConfigResponse } from '@gami/shared'
import type { FastifyInstance } from 'fastify'
import type { ModelConfig } from '../../domain/model-config/index.js'
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

function makeAppWithFallback(modelConfigFallback: ModelConfig): FastifyInstance {
  const app = createServer(TEST_CONFIG, { modelConfigFallback })
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

  it('returns runtime-effective global provider fallback when config row is missing', async () => {
    const response = await makeAppWithFallback({
      globalDefault: { provider: 'openai', model: '' },
      roleOverrides: {},
      updatedAt: new Date(0).toISOString(),
    }).inject({
      method: 'GET',
      url: '/v1/admin/model-config',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ modelConfig: ModelConfigResponse }>>()
    expect(body.error).toBeNull()
    expect(body.data?.modelConfig.globalDefault.provider).toBe('openai')
    expect(body.data?.modelConfig.globalDefault.model).toBe('')
  })
})

describe('PUT /v1/admin/model-config auth and validation', () => {
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

  it('returns 401 when API key is wrong', async () => {
    const response = await makeApp().inject({
      method: 'PUT',
      url: '/v1/admin/model-config',
      headers: authHeaders('wrong-key'),
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
})

describe('PUT /v1/admin/model-config schema edge validation', () => {
  it('ignores unknown top-level fields and persists valid payload', async () => {
    const response = await makeApp().inject({
      method: 'PUT',
      url: '/v1/admin/model-config',
      headers: authHeaders(),
      payload: {
        globalDefault: { provider: 'openai', model: 'gpt-4.1-mini' },
        unknownField: 'nope',
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ modelConfig: ModelConfigResponse }>>()
    expect(body.error).toBeNull()
    expect(body.data?.modelConfig.globalDefault.provider).toBe('openai')
  })

  it('returns 400 VALIDATION_ERROR when roleOverrides is an array', async () => {
    const response = await makeApp().inject({
      method: 'PUT',
      url: '/v1/admin/model-config',
      headers: authHeaders(),
      payload: {
        globalDefault: { provider: 'openai', model: 'gpt-4.1-mini' },
        roleOverrides: [],
      },
    })

    expect(response.statusCode).toBe(400)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 VALIDATION_ERROR when role override provider is null', async () => {
    const response = await makeApp().inject({
      method: 'PUT',
      url: '/v1/admin/model-config',
      headers: authHeaders(),
      payload: {
        globalDefault: { provider: 'openai', model: 'gpt-4.1-mini' },
        roleOverrides: { avatar: { provider: null } },
      },
    })

    expect(response.statusCode).toBe(400)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 VALIDATION_ERROR for model strings longer than 200 chars', async () => {
    const response = await makeApp().inject({
      method: 'PUT',
      url: '/v1/admin/model-config',
      headers: authHeaders(),
      payload: {
        globalDefault: { provider: 'openai', model: 'x'.repeat(201) },
      },
    })

    expect(response.statusCode).toBe(400)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('VALIDATION_ERROR')
    expect(body.error?.message).toContain('at most 200 characters')
  })
})

describe('PUT /v1/admin/model-config persistence', () => {
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

import { afterEach, describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import type { FastifyInstance } from 'fastify'
import type { Config } from '../../config.js'
import { InMemoryUserRepository } from '../../infrastructure/db/in-memory-user.repository.js'
import { createServer } from '../server.js'

const testConfig: Config = {
  port: 3000,
  host: '0.0.0.0',
  nodeEnv: 'test',
  logLevel: 'silent',
  databaseUrl: 'postgresql://test',
  redisUrl: 'redis://test',
  apiKeySecret: 'test-secret',
  corsOrigin: '*',
  llmProvider: 'null',
  openaiApiKey: undefined,
  anthropicApiKey: undefined,
  mistralApiKey: undefined,
  langfusePublicKey: undefined,
  langfuseSecretKey: undefined,
  langfuseHost: undefined,
}

const appsToClose: FastifyInstance[] = []

afterEach(async () => {
  await Promise.all(appsToClose.splice(0).map(async (app) => app.close()))
})

function authHeaders(apiKey = 'test-secret'): { 'x-api-key': string } {
  return { 'x-api-key': apiKey }
}

function makeApp(): FastifyInstance {
  const app = createServer(testConfig, {
    userRepository: new InMemoryUserRepository(),
  })
  appsToClose.push(app)
  return app
}

function makeFailingApp(): FastifyInstance {
  const failingRepo = {
    findById: () => Promise.reject(new Error('read failed')),
    upsert: () => Promise.reject(new Error('write failed')),
  }
  const app = createServer(testConfig, {
    userRepository: failingRepo,
  })
  appsToClose.push(app)
  return app
}

describe('PUT /v1/users/:userId/persona', () => {
  it('stores valid persona and returns user', async () => {
    const app = makeApp()
    const response = await app.inject({
      method: 'PUT',
      url: '/v1/users/user_1/persona',
      headers: authHeaders(),
      payload: {
        name: 'Sam',
        roleInWorld: 'mentor',
        avatarRelationships: ['Friend of Eva'],
        dialogGuidance: 'Use practical examples',
      },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ user: { userId: string } }>>()
    expect(body.error).toBeNull()
    expect(body.data?.user.userId).toBe('user_1')
  })

  it('replaces persona on second upsert for same userId', async () => {
    const app = makeApp()

    const first = await app.inject({
      method: 'PUT',
      url: '/v1/users/user_1/persona',
      headers: authHeaders(),
      payload: { name: 'Sam', roleInWorld: 'mentor', avatarRelationships: ['Friend of Eva'] },
    })
    expect(first.statusCode).toBe(200)

    const second = await app.inject({
      method: 'PUT',
      url: '/v1/users/user_1/persona',
      headers: authHeaders(),
      payload: { name: 'Lina', roleInWorld: 'architect', dialogGuidance: 'Be direct' },
    })
    expect(second.statusCode).toBe(200)
    const secondBody =
      second.json<ApiResponse<{ user: { persona?: { name?: string; roleInWorld?: string } } }>>()
    expect(secondBody.data?.user.persona).toEqual({
      name: 'Lina',
      roleInWorld: 'architect',
      dialogGuidance: 'Be direct',
    })
  })

  it('accepts empty persona object', async () => {
    const app = makeApp()
    const response = await app.inject({
      method: 'PUT',
      url: '/v1/users/user_1/persona',
      headers: authHeaders(),
      payload: {},
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ user: { persona?: Record<string, unknown> } }>>()
    expect(body.error).toBeNull()
    expect(body.data?.user.persona).toEqual({})
  })

  it('returns 400 when body contains unknown fields', async () => {
    const app = makeApp()
    const response = await app.inject({
      method: 'PUT',
      url: '/v1/users/user_1/persona',
      headers: authHeaders(),
      payload: { unknownField: 'x' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 400 when userId is whitespace only', async () => {
    const app = makeApp()
    const response = await app.inject({
      method: 'PUT',
      url: '/v1/users/%20%20%20/persona',
      headers: authHeaders(),
      payload: {},
    })

    expect(response.statusCode).toBe(400)
  })

  it('returns 500 when repository upsert throws unexpectedly', async () => {
    const app = makeFailingApp()
    const response = await app.inject({
      method: 'PUT',
      url: '/v1/users/user_1/persona',
      headers: authHeaders(),
      payload: { name: 'Sam' },
    })

    expect(response.statusCode).toBe(500)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('INTERNAL_ERROR')
  })
})

describe('GET /v1/users/:userId/persona', () => {
  it('returns persona after put', async () => {
    const app = makeApp()

    const put = await app.inject({
      method: 'PUT',
      url: '/v1/users/user_1/persona',
      headers: authHeaders(),
      payload: { name: 'Sam', roleInWorld: 'mentor', avatarRelationships: ['Friend of Eva'] },
    })
    expect(put.statusCode).toBe(200)

    const get = await app.inject({
      method: 'GET',
      url: '/v1/users/user_1/persona',
      headers: authHeaders(),
    })
    expect(get.statusCode).toBe(200)
    const body =
      get.json<ApiResponse<{ persona: { name?: string; avatarRelationships?: string[] } }>>()
    expect(body.error).toBeNull()
    expect(body.data?.persona).toEqual({
      name: 'Sam',
      roleInWorld: 'mentor',
      avatarRelationships: ['Friend of Eva'],
    })
  })

  it('returns null for unknown user', async () => {
    const app = makeApp()

    const response = await app.inject({
      method: 'GET',
      url: '/v1/users/missing/persona',
      headers: authHeaders(),
    })
    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ persona: null }>>()
    expect(body.error).toBeNull()
    expect(body.data?.persona).toBeNull()
  })

  it('returns 500 when repository findById throws unexpectedly', async () => {
    const app = makeFailingApp()
    const response = await app.inject({
      method: 'GET',
      url: '/v1/users/user_1/persona',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(500)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('INTERNAL_ERROR')
  })
})

describe('CORS preflight for persona routes', () => {
  it('allows PUT in preflight response for persona upsert', async () => {
    const app = makeApp()
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/v1/users/tester/persona',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'PUT',
      },
    })

    expect(response.statusCode).toBe(204)
    expect(response.headers['access-control-allow-methods']).toContain('PUT')
  })
})

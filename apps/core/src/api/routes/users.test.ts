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

describe('PUT /v1/users/:userId/persona', () => {
  it('stores valid persona and returns user', async () => {
    const app = makeApp()
    const response = await app.inject({
      method: 'PUT',
      url: '/v1/users/user_1/persona',
      headers: authHeaders(),
      payload: {
        role: 'mentor',
        tonePreference: 'direct',
        interactionHints: ['concise'],
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
      payload: { role: 'mentor', interactionHints: ['concise'] },
    })
    expect(first.statusCode).toBe(200)

    const second = await app.inject({
      method: 'PUT',
      url: '/v1/users/user_1/persona',
      headers: authHeaders(),
      payload: { role: 'architect', tonePreference: 'warm' },
    })
    expect(second.statusCode).toBe(200)
    const secondBody =
      second.json<ApiResponse<{ user: { persona?: { role?: string; tonePreference?: string } } }>>()
    expect(secondBody.data?.user.persona).toEqual({
      role: 'architect',
      tonePreference: 'warm',
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
})

describe('GET /v1/users/:userId/persona', () => {
  it('returns persona after put', async () => {
    const app = makeApp()

    const put = await app.inject({
      method: 'PUT',
      url: '/v1/users/user_1/persona',
      headers: authHeaders(),
      payload: { role: 'mentor', interactionHints: ['concise'] },
    })
    expect(put.statusCode).toBe(200)

    const get = await app.inject({
      method: 'GET',
      url: '/v1/users/user_1/persona',
      headers: authHeaders(),
    })
    expect(get.statusCode).toBe(200)
    const body =
      get.json<ApiResponse<{ persona: { role?: string; interactionHints?: string[] } }>>()
    expect(body.error).toBeNull()
    expect(body.data?.persona).toEqual({
      role: 'mentor',
      interactionHints: ['concise'],
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
})

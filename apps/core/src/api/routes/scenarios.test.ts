import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import type { Config } from '../../config.js'
import { createServer } from '../server.js'

const testConfig: Config = {
  port: 3000,
  host: '0.0.0.0',
  nodeEnv: 'test',
  logLevel: 'silent',
  databaseUrl: 'postgresql://test',
  redisUrl: 'redis://test',
  apiKeySecret: 'test-secret',
  llmProvider: 'null',
  openaiApiKey: undefined,
  anthropicApiKey: undefined,
  mistralApiKey: undefined,
  langfusePublicKey: undefined,
  langfuseSecretKey: undefined,
  langfuseHost: undefined,
}

type CreateScenarioRouteData = {
  scenario: {
    scenarioId: string
    name: string
    slug: string
    status: 'draft' | 'active' | 'archived'
    config: Record<string, unknown>
    createdAt: string
    updatedAt: string
  }
}

type CreateAvatarRouteData = {
  avatar: {
    avatarId: string
    scenarioId: string
    name: string
    slug: string
    status: 'draft' | 'active' | 'archived'
    personaPrompt: string
    createdAt: string
    updatedAt: string
  }
}

describe('POST /v1/scenarios — auth', () => {
  it('returns 401 when API key is missing', async () => {
    const response = await createServer(testConfig).inject({
      method: 'POST',
      url: '/v1/scenarios',
      payload: { name: 'Demo', slug: 'demo-scenario' },
    })

    expect(response.statusCode).toBe(401)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })

  it('returns 401 when API key is wrong', async () => {
    const response = await createServer(testConfig).inject({
      method: 'POST',
      url: '/v1/scenarios',
      headers: { 'x-api-key': 'wrong-secret' },
      payload: { name: 'Demo', slug: 'demo-scenario' },
    })

    expect(response.statusCode).toBe(401)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })
})

describe('POST /v1/scenarios — validation', () => {
  it('returns 400 when name is missing', async () => {
    const response = await createServer(testConfig).inject({
      method: 'POST',
      url: '/v1/scenarios',
      headers: { 'x-api-key': 'test-secret' },
      payload: { slug: 'demo-scenario' },
    })

    expect(response.statusCode).toBe(400)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when slug is missing', async () => {
    const response = await createServer(testConfig).inject({
      method: 'POST',
      url: '/v1/scenarios',
      headers: { 'x-api-key': 'test-secret' },
      payload: { name: 'Demo' },
    })

    expect(response.statusCode).toBe(400)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when slug format is invalid', async () => {
    const response = await createServer(testConfig).inject({
      method: 'POST',
      url: '/v1/scenarios',
      headers: { 'x-api-key': 'test-secret' },
      payload: { name: 'Demo', slug: 'Demo Scenario' },
    })

    expect(response.statusCode).toBe(400)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when status value is invalid', async () => {
    const response = await createServer(testConfig).inject({
      method: 'POST',
      url: '/v1/scenarios',
      headers: { 'x-api-key': 'test-secret' },
      payload: { name: 'Demo', slug: 'demo-scenario', status: 'paused' },
    })

    expect(response.statusCode).toBe(400)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })
})

describe('POST /v1/scenarios — success', () => {
  it('returns 201 with created scenario in response envelope', async () => {
    const response = await createServer(testConfig).inject({
      method: 'POST',
      url: '/v1/scenarios',
      headers: { 'x-api-key': 'test-secret' },
      payload: {
        name: 'Demo Scenario',
        slug: 'demo-scenario',
        config: { worldContext: 'A test world' },
      },
    })

    expect(response.statusCode).toBe(201)
    const body = response.json<ApiResponse<CreateScenarioRouteData>>()
    expect(body.error).toBeNull()
    expect(body.data?.scenario.scenarioId).toBeTruthy()
    expect(body.data?.scenario.status).toBe('draft')
  })
})

describe('POST /v1/scenarios/:scenarioId/avatars — auth', () => {
  it('returns 401 when API key is missing', async () => {
    const response = await createServer(testConfig).inject({
      method: 'POST',
      url: '/v1/scenarios/scenario_unknown/avatars',
      payload: {
        name: 'Avatar',
        slug: 'avatar-no-key',
        personaPrompt: 'You are a helper.',
      },
    })

    expect(response.statusCode).toBe(401)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('UNAUTHORIZED')
  })
})

describe('POST /v1/scenarios/:scenarioId/avatars — validation', () => {
  it('returns 400 when personaPrompt is missing', async () => {
    const response = await createServer(testConfig).inject({
      method: 'POST',
      url: '/v1/scenarios/scenario_unknown/avatars',
      headers: { 'x-api-key': 'test-secret' },
      payload: { name: 'Avatar', slug: 'avatar-validation' },
    })

    expect(response.statusCode).toBe(400)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })
})

describe('POST /v1/scenarios/:scenarioId/avatars — resource lookup', () => {
  it('returns 404 when scenario does not exist', async () => {
    const response = await createServer(testConfig).inject({
      method: 'POST',
      url: '/v1/scenarios/scenario_unknown/avatars',
      headers: { 'x-api-key': 'test-secret' },
      payload: {
        name: 'Avatar',
        slug: 'avatar-unknown-scenario',
        personaPrompt: 'You are a helper.',
      },
    })

    expect(response.statusCode).toBe(404)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('NOT_FOUND')
  })
})

describe('POST /v1/scenarios/:scenarioId/avatars — success', () => {
  it('returns 201 with created avatar in response envelope', async () => {
    const app = createServer(testConfig)
    const createScenarioResponse = await app.inject({
      method: 'POST',
      url: '/v1/scenarios',
      headers: { 'x-api-key': 'test-secret' },
      payload: {
        name: 'Avatar Scenario',
        slug: 'avatar-scenario',
      },
    })

    expect(createScenarioResponse.statusCode).toBe(201)
    const scenarioBody = createScenarioResponse.json<ApiResponse<CreateScenarioRouteData>>()
    const scenarioId = scenarioBody.data?.scenario.scenarioId
    expect(scenarioId).toBeTruthy()
    if (scenarioId === undefined) {
      throw new Error('Expected scenarioId to be present in create scenario response')
    }

    const createAvatarResponse = await app.inject({
      method: 'POST',
      url: `/v1/scenarios/${scenarioId}/avatars`,
      headers: { 'x-api-key': 'test-secret' },
      payload: {
        name: 'Ava',
        slug: 'ava',
        personaPrompt: 'You are Ava.',
      },
    })

    expect(createAvatarResponse.statusCode).toBe(201)
    const avatarBody = createAvatarResponse.json<ApiResponse<CreateAvatarRouteData>>()
    expect(avatarBody.error).toBeNull()
    expect(avatarBody.data?.avatar.avatarId.startsWith('avatar_')).toBe(true)
    expect(avatarBody.data?.avatar.scenarioId).toBe(scenarioId)
  })
})

import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const API_KEY = 'e2e-stack-secret'
const UNKNOWN_ENDPOINT = `${APP_URL}/v1/scenarios/scenario_unknown/avatars`

type CreateScenarioResponse = {
  scenario: {
    scenarioId: string
  }
}

type CreateAvatarResponse = {
  avatar: {
    avatarId: string
    scenarioId: string
  }
}

describe('Stack E2E — POST /v1/scenarios/:scenarioId/avatars — auth', () => {
  it('rejects requests with no API key (401)', async () => {
    const res = await fetch(UNKNOWN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Avatar',
        personaPrompt: 'You are a helpful avatar.',
      }),
    })

    expect(res.status).toBe(401)
  })

  it('rejects requests with wrong API key (401)', async () => {
    const res = await fetch(UNKNOWN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'wrong-key',
      },
      body: JSON.stringify({
        name: 'Avatar',
        personaPrompt: 'You are a helpful avatar.',
      }),
    })

    expect(res.status).toBe(401)
  })
})

describe('Stack E2E — POST /v1/scenarios/:scenarioId/avatars — validation', () => {
  it('rejects requests with missing name field (400)', async () => {
    const res = await fetch(UNKNOWN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        personaPrompt: 'You are a helpful avatar.',
      }),
    })

    expect(res.status).toBe(400)
  })

  it('rejects requests with missing personaPrompt field (400)', async () => {
    const res = await fetch(UNKNOWN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        name: 'Avatar',
      }),
    })

    expect(res.status).toBe(400)
  })
})

describe('Stack E2E — POST /v1/scenarios/:scenarioId/avatars — resource lookup', () => {
  it('returns 404 when scenarioId is unknown', async () => {
    const res = await fetch(UNKNOWN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        name: 'Avatar',
        personaPrompt: 'You are a helpful avatar.',
      }),
    })

    expect(res.status).toBe(404)
  })
})

describe('Stack E2E — POST /v1/scenarios/:scenarioId/avatars — success', () => {
  it('creates avatar and returns 201 for a valid scenario', async () => {
    const createScenarioRes = await fetch(`${APP_URL}/v1/scenarios`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        name: 'Avatar E2E Scenario',
      }),
    })

    expect(createScenarioRes.status).toBe(201)
    const createdScenario = (await createScenarioRes.json()) as ApiResponse<CreateScenarioResponse>
    const scenarioId = createdScenario.data?.scenario.scenarioId ?? ''

    const createAvatarRes = await fetch(`${APP_URL}/v1/scenarios/${scenarioId}/avatars`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        name: 'E2E Avatar',
        personaPrompt: 'You are an E2E test avatar.',
      }),
    })

    expect(createAvatarRes.status).toBe(201)

    const avatarBody = (await createAvatarRes.json()) as ApiResponse<CreateAvatarResponse>
    expect(avatarBody.error).toBeNull()
    expect(avatarBody.data?.avatar.avatarId.startsWith('avatar_')).toBe(true)
    expect(avatarBody.data?.avatar.scenarioId).toBe(scenarioId)
  })
})

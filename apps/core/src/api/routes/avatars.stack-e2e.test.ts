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
    updatedAt: string
  }
}

type PatchAvatarResponse = {
  avatar: {
    avatarId: string
    personaPrompt: string
    updatedAt: string
  }
}

type ListScenariosResponse = {
  scenarios: Array<{
    scenarioId: string
  }>
}

type ListAvatarsResponse = {
  avatars: Array<{
    avatarId: string
  }>
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

describe('Stack E2E — scenario/avatar management full flow', () => {
  it('runs create scenario -> create avatar -> list scenarios -> list avatars -> delete avatar -> delete scenario', async () => {
    const createScenarioRes = await fetch(`${APP_URL}/v1/scenarios`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        name: `Ops Flow Scenario ${String(Date.now())}`,
      }),
    })
    expect(createScenarioRes.status).toBe(201)
    const createdScenario = (await createScenarioRes.json()) as ApiResponse<CreateScenarioResponse>
    const scenarioId = createdScenario.data?.scenario.scenarioId ?? ''
    expect(scenarioId.startsWith('scenario_')).toBe(true)

    const createAvatarRes = await fetch(`${APP_URL}/v1/scenarios/${scenarioId}/avatars`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        name: 'Ops Flow Avatar',
        personaPrompt: 'You are an operational test avatar.',
      }),
    })
    expect(createAvatarRes.status).toBe(201)
    const createdAvatar = (await createAvatarRes.json()) as ApiResponse<CreateAvatarResponse>
    const avatarId = createdAvatar.data?.avatar.avatarId ?? ''
    expect(avatarId.startsWith('avatar_')).toBe(true)

    const listScenariosRes = await fetch(`${APP_URL}/v1/scenarios`, {
      method: 'GET',
      headers: { 'x-api-key': API_KEY },
    })
    expect(listScenariosRes.status).toBe(200)
    const listScenariosBody = (await listScenariosRes.json()) as ApiResponse<ListScenariosResponse>
    expect(
      listScenariosBody.data?.scenarios.some((scenario) => scenario.scenarioId === scenarioId),
    ).toBe(true)

    const listAvatarsRes = await fetch(`${APP_URL}/v1/scenarios/${scenarioId}/avatars`, {
      method: 'GET',
      headers: { 'x-api-key': API_KEY },
    })
    expect(listAvatarsRes.status).toBe(200)
    const listAvatarsBody = (await listAvatarsRes.json()) as ApiResponse<ListAvatarsResponse>
    expect(listAvatarsBody.data?.avatars.some((avatar) => avatar.avatarId === avatarId)).toBe(true)

    const deleteAvatarRes = await fetch(`${APP_URL}/v1/avatars/${avatarId}`, {
      method: 'DELETE',
      headers: { 'x-api-key': API_KEY },
    })
    expect(deleteAvatarRes.status).toBe(200)

    const deleteScenarioRes = await fetch(`${APP_URL}/v1/scenarios/${scenarioId}`, {
      method: 'DELETE',
      headers: { 'x-api-key': API_KEY },
    })
    expect(deleteScenarioRes.status).toBe(200)
  })
})

describe('Stack E2E — PATCH /v1/avatars/:avatarId — auth', () => {
  it('rejects requests with no API key (401)', async () => {
    const res = await fetch(`${APP_URL}/v1/avatars/avatar_any`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New name' }),
    })

    expect(res.status).toBe(401)
  })

  it('rejects requests with wrong API key (401)', async () => {
    const res = await fetch(`${APP_URL}/v1/avatars/avatar_any`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-api-key': 'wrong-key' },
      body: JSON.stringify({ name: 'New name' }),
    })

    expect(res.status).toBe(401)
  })
})

describe('Stack E2E — PATCH /v1/avatars/:avatarId — validation', () => {
  it('returns 400 for empty body', async () => {
    const res = await fetch(`${APP_URL}/v1/avatars/avatar_any`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
    const body = (await res.json()) as ApiResponse<null>
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })
})

describe('Stack E2E — PATCH /v1/avatars/:avatarId — resource lookup', () => {
  it('returns 404 for nonexistent avatar', async () => {
    const res = await fetch(`${APP_URL}/v1/avatars/avatar_nonexistent_id_123`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({ name: 'New name' }),
    })

    expect(res.status).toBe(404)
    const body = (await res.json()) as ApiResponse<null>
    expect(body.error?.code).toBe('NOT_FOUND')
  })
})

describe('Stack E2E — PATCH /v1/avatars/:avatarId — success', () => {
  it('updates personaPrompt and reflects new value with refreshed updatedAt', async () => {
    const createScenarioRes = await fetch(`${APP_URL}/v1/scenarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({ name: `PATCH Avatar E2E Scenario ${String(Date.now())}` }),
    })
    expect(createScenarioRes.status).toBe(201)
    const createdScenario = (await createScenarioRes.json()) as ApiResponse<CreateScenarioResponse>
    const scenarioId = createdScenario.data?.scenario.scenarioId ?? ''

    const createAvatarRes = await fetch(`${APP_URL}/v1/scenarios/${scenarioId}/avatars`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({
        name: 'PATCH E2E Avatar',
        personaPrompt: 'Original prompt.',
      }),
    })
    expect(createAvatarRes.status).toBe(201)
    const createdAvatar = (await createAvatarRes.json()) as ApiResponse<CreateAvatarResponse>
    const avatarId = createdAvatar.data?.avatar.avatarId ?? ''
    const originalUpdatedAt = createdAvatar.data?.avatar.updatedAt ?? ''

    const patchRes = await fetch(`${APP_URL}/v1/avatars/${avatarId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({ personaPrompt: 'Patched prompt.' }),
    })
    expect(patchRes.status).toBe(200)
    const patchBody = (await patchRes.json()) as ApiResponse<PatchAvatarResponse>
    expect(patchBody.error).toBeNull()
    expect(patchBody.data?.avatar.personaPrompt).toBe('Patched prompt.')
    expect(patchBody.data?.avatar.avatarId).toBe(avatarId)
    expect(patchBody.data?.avatar.updatedAt).not.toBe(originalUpdatedAt)
  })
})

async function createScenarioAndAvatarForOverride(): Promise<{
  scenarioId: string
  avatarId: string
}> {
  const createScenarioRes = await fetch(`${APP_URL}/v1/scenarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({ name: `Llm Override Scenario ${String(Date.now())}` }),
  })
  expect(createScenarioRes.status).toBe(201)
  const scenarioBody = (await createScenarioRes.json()) as ApiResponse<CreateScenarioResponse>
  const scenarioId = scenarioBody.data?.scenario.scenarioId ?? ''

  const createAvatarRes = await fetch(`${APP_URL}/v1/scenarios/${scenarioId}/avatars`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({
      name: 'Override Avatar',
      personaPrompt: 'You are override avatar.',
    }),
  })
  expect(createAvatarRes.status).toBe(201)
  const createAvatarBody = (await createAvatarRes.json()) as ApiResponse<CreateAvatarResponse>
  const avatarId = createAvatarBody.data?.avatar.avatarId ?? ''

  return { scenarioId, avatarId }
}

describe('Stack E2E — avatar llmOverride flow', () => {
  it('sets llmOverride and rejects invalid values', async () => {
    const { avatarId } = await createScenarioAndAvatarForOverride()

    const patchSetRes = await fetch(`${APP_URL}/v1/avatars/${avatarId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({ llmOverride: { provider: 'openai' } }),
    })
    expect(patchSetRes.status).toBe(200)
    const patchSetBody = (await patchSetRes.json()) as ApiResponse<{
      avatar: { llmOverride?: { provider?: string; model?: string } }
    }>
    expect(patchSetBody.data?.avatar.llmOverride?.provider).toBe('openai')

    const patchInvalidProviderRes = await fetch(`${APP_URL}/v1/avatars/${avatarId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({ llmOverride: { provider: 'not-a-provider' } }),
    })
    expect(patchInvalidProviderRes.status).toBe(400)
    const invalidProviderBody = (await patchInvalidProviderRes.json()) as ApiResponse<null>
    expect(invalidProviderBody.error?.code).toBe('VALIDATION_ERROR')

    const patchInvalidModelRes = await fetch(`${APP_URL}/v1/avatars/${avatarId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({ llmOverride: { model: '   ' } }),
    })
    expect(patchInvalidModelRes.status).toBe(400)
    const invalidModelBody = (await patchInvalidModelRes.json()) as ApiResponse<null>
    expect(invalidModelBody.error?.code).toBe('VALIDATION_ERROR')
  })

  it('clears llmOverride and returns override in GET list after set', async () => {
    const { scenarioId, avatarId } = await createScenarioAndAvatarForOverride()

    const patchSetModelRes = await fetch(`${APP_URL}/v1/avatars/${avatarId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({ llmOverride: { provider: 'anthropic', model: 'claude-3-7-sonnet' } }),
    })
    expect(patchSetModelRes.status).toBe(200)

    const listRes = await fetch(`${APP_URL}/v1/scenarios/${scenarioId}/avatars`, {
      method: 'GET',
      headers: { 'x-api-key': API_KEY },
    })
    expect(listRes.status).toBe(200)
    const listBody = (await listRes.json()) as ApiResponse<{
      avatars: Array<{ avatarId: string; llmOverride?: { provider?: string; model?: string } }>
    }>
    const listed = listBody.data?.avatars.find((avatar) => avatar.avatarId === avatarId)
    expect(listed?.llmOverride).toEqual({ provider: 'anthropic', model: 'claude-3-7-sonnet' })

    const patchClearRes = await fetch(`${APP_URL}/v1/avatars/${avatarId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({ llmOverride: null }),
    })
    expect(patchClearRes.status).toBe(200)
    const clearBody = (await patchClearRes.json()) as ApiResponse<{
      avatar: { llmOverride?: { provider?: string; model?: string } }
    }>
    expect(clearBody.data?.avatar.llmOverride).toBeUndefined()
  })
})

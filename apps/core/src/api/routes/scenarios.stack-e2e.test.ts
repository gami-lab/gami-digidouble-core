import { describe, expect, it } from 'vitest'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const API_KEY = 'e2e-stack-secret'
const ENDPOINT = `${APP_URL}/v1/scenarios`

describe('Stack E2E — POST /v1/scenarios — auth', () => {
  it('rejects requests with no API key (401)', async () => {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'E2E Scenario' }),
    })

    expect(res.status).toBe(401)
  })

  it('rejects requests with wrong API key (401)', async () => {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'wrong-key',
      },
      body: JSON.stringify({ name: 'E2E Scenario' }),
    })

    expect(res.status).toBe(401)
  })
})

describe('Stack E2E — POST /v1/scenarios — validation', () => {
  it('rejects requests with missing name field (400)', async () => {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
  })

  it('rejects requests with missing required fields (400)', async () => {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
  })

  it('rejects requests with invalid modelSelection catalog entry (400)', async () => {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        name: 'Invalid Catalog Scenario',
        modelSelection: {
          defaultProfile: { provider: 'openai', model: 'unknown-model' },
        },
      }),
    })

    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('Stack E2E — POST /v1/scenarios — success', () => {
  it('creates scenario and returns 201 with default draft status', async () => {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        name: 'E2E Scenario',
      }),
    })

    expect(res.status).toBe(201)

    const body = (await res.json()) as {
      data: { scenario: { scenarioId: string; status: string } }
      error: null
    }
    expect(body.error).toBeNull()
    expect(body.data.scenario.scenarioId.startsWith('scenario_')).toBe(true)
    expect(body.data.scenario.status).toBe('draft')
  })

  it('creates scenario with runtime model selection', async () => {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        name: 'Scenario With Models',
        modelSelection: {
          defaultProfile: { provider: 'openai', model: 'gpt-4o' },
          gameMasterOverride: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
        },
      }),
    })

    expect(res.status).toBe(201)
    const body = (await res.json()) as {
      data: {
        scenario: {
          modelSelection?: {
            defaultProfile?: { provider: string; model: string }
            gameMasterOverride?: { provider: string; model: string }
          }
        }
      }
      error: null
    }
    expect(body.error).toBeNull()
    expect(body.data.scenario.modelSelection).toEqual({
      defaultProfile: { provider: 'openai', model: 'gpt-4o' },
      gameMasterOverride: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
    })
  })
})

describe('Stack E2E — PATCH /v1/scenarios/:id — auth', () => {
  it('rejects requests with no API key (401)', async () => {
    const res = await fetch(`${ENDPOINT}/scenario_nonexistent`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    })

    expect(res.status).toBe(401)
  })

  it('rejects requests with wrong API key (401)', async () => {
    const res = await fetch(`${ENDPOINT}/scenario_nonexistent`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'wrong-key',
      },
      body: JSON.stringify({ name: 'Updated' }),
    })

    expect(res.status).toBe(401)
  })
})

describe('Stack E2E — PATCH /v1/scenarios/:id — not found', () => {
  it('returns 404 for unknown scenario id', async () => {
    const res = await fetch(`${ENDPOINT}/scenario_nonexistent`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ name: 'Updated' }),
    })

    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('NOT_FOUND')
  })
})

describe('Stack E2E — PATCH /v1/scenarios/:id — validation', () => {
  it('returns 400 when body has no updatable fields', async () => {
    const createRes = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ name: 'Scenario For Patch Validation' }),
    })
    expect(createRes.status).toBe(201)
    const created = (await createRes.json()) as {
      data: { scenario: { scenarioId: string } }
    }
    const scenarioId = created.data.scenario.scenarioId

    const res = await fetch(`${ENDPOINT}/${scenarioId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('Stack E2E — PATCH /v1/scenarios/:id — success', () => {
  it('updates scenario name and returns 200 with updated scenario', async () => {
    const createRes = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ name: 'Original Name' }),
    })
    expect(createRes.status).toBe(201)
    const created = (await createRes.json()) as {
      data: { scenario: { scenarioId: string; updatedAt: string } }
    }
    const { scenarioId, updatedAt: originalUpdatedAt } = created.data.scenario

    const patchRes = await fetch(`${ENDPOINT}/${scenarioId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ name: 'Updated Name' }),
    })

    expect(patchRes.status).toBe(200)
    const patched = (await patchRes.json()) as {
      data: { scenario: { scenarioId: string; name: string; status: string; updatedAt: string } }
      error: null
    }
    expect(patched.error).toBeNull()
    expect(patched.data.scenario.scenarioId).toBe(scenarioId)
    expect(patched.data.scenario.name).toBe('Updated Name')
    expect(patched.data.scenario.status).toBe('draft')
    expect(patched.data.scenario.updatedAt).not.toBe(originalUpdatedAt)
  })

  it('updates and clears modelSelection', async () => {
    const createRes = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ name: 'Model Selection Scenario' }),
    })
    expect(createRes.status).toBe(201)
    const created = (await createRes.json()) as {
      data: { scenario: { scenarioId: string } }
    }
    const scenarioId = created.data.scenario.scenarioId

    const patchSetRes = await fetch(`${ENDPOINT}/${scenarioId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        modelSelection: {
          defaultProfile: { provider: 'mistral', model: 'mistral-small-4' },
        },
      }),
    })
    expect(patchSetRes.status).toBe(200)
    const patchSetBody = (await patchSetRes.json()) as {
      data: {
        scenario: {
          modelSelection?: { defaultProfile?: { provider: string; model: string } }
        }
      }
    }
    expect(patchSetBody.data.scenario.modelSelection).toEqual({
      defaultProfile: { provider: 'mistral', model: 'mistral-small-4' },
    })

    const patchClearRes = await fetch(`${ENDPOINT}/${scenarioId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ modelSelection: null }),
    })
    expect(patchClearRes.status).toBe(200)
    const patchClearBody = (await patchClearRes.json()) as {
      data: { scenario: { modelSelection?: unknown } }
    }
    expect(patchClearBody.data.scenario.modelSelection).toBeUndefined()
  })
})

import { describe, expect, it } from 'vitest'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const API_KEY = 'e2e-stack-secret'
const ENDPOINT = `${APP_URL}/v1/scenarios`

describe('Stack E2E — POST /v1/scenarios — auth', () => {
  it('rejects requests with no API key (401)', async () => {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'E2E Scenario', slug: 'e2e-scenario-no-key' }),
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
      body: JSON.stringify({ name: 'E2E Scenario', slug: 'e2e-scenario-wrong-key' }),
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
      body: JSON.stringify({ slug: 'missing-name' }),
    })

    expect(res.status).toBe(400)
  })

  it('rejects requests with missing slug field (400)', async () => {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ name: 'Missing Slug' }),
    })

    expect(res.status).toBe(400)
  })

  it('rejects requests with invalid slug format (400)', async () => {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ name: 'Invalid Slug', slug: 'Invalid Slug' }),
    })

    expect(res.status).toBe(400)
  })
})

describe('Stack E2E — POST /v1/scenarios — success', () => {
  it('creates scenario and returns 201 with default draft status', async () => {
    const uniqueSlug = `e2e-scenario-${String(Date.now())}`

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        name: 'E2E Scenario',
        slug: uniqueSlug,
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
})

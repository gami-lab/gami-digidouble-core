import { describe, expect, it } from 'vitest'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const API_KEY = 'e2e-stack-secret'
const START_ENDPOINT = `${APP_URL}/v1/conversations/start`

describe('Stack E2E — POST /v1/conversations/start — auth', () => {
  it('rejects requests with no API key (401)', async () => {
    const res = await fetch(START_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user_test', scenarioId: 'scenario_test_default' }),
    })

    expect(res.status).toBe(401)
  })

  it('rejects requests with wrong API key (401)', async () => {
    const res = await fetch(START_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'wrong-key',
      },
      body: JSON.stringify({ userId: 'user_test', scenarioId: 'scenario_test_default' }),
    })

    expect(res.status).toBe(401)
  })
})

describe('Stack E2E — POST /v1/conversations/start — validation', () => {
  it('rejects requests with blank userId (400)', async () => {
    const res = await fetch(START_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ userId: '', scenarioId: 'scenario_test_default' }),
    })

    expect(res.status).toBe(400)
  })

  it('rejects requests with blank scenarioId (400)', async () => {
    const res = await fetch(START_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ userId: 'user_test', scenarioId: '' }),
    })

    expect(res.status).toBe(400)
  })
})

describe('Stack E2E — conversations routes — not found', () => {
  it('returns 404 for unknown session on history and reset', async () => {
    const historyRes = await fetch(`${APP_URL}/v1/conversations/session_unknown/history`, {
      method: 'GET',
      headers: { 'x-api-key': API_KEY },
    })
    expect(historyRes.status).toBe(404)

    const resetRes = await fetch(`${APP_URL}/v1/conversations/session_unknown`, {
      method: 'DELETE',
      headers: { 'x-api-key': API_KEY },
    })
    expect(resetRes.status).toBe(404)
  })

  it('returns 404 when start-session scenarioId does not exist', async () => {
    const res = await fetch(START_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        userId: `user_${String(Date.now())}`,
        scenarioId: 'scenario_missing',
      }),
    })
    expect(res.status).toBe(404)
  })
})

describe('Stack E2E — conversations lifecycle happy path', () => {
  it('runs start -> history -> reset -> history via real HTTP', async () => {
    const scenarioRes = await fetch(`${APP_URL}/v1/scenarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify({ name: 'Lifecycle Test Scenario' }),
    })
    expect(scenarioRes.status).toBe(201)
    const scenarioBody = (await scenarioRes.json()) as {
      data: { scenario: { scenarioId: string } }
      error: null
    }
    const scenarioId = scenarioBody.data.scenario.scenarioId

    const userId = `user_stack_${String(Date.now())}`

    const startRes = await fetch(START_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ userId, scenarioId }),
    })
    expect(startRes.status).toBe(201)
    const startBody = (await startRes.json()) as {
      data: { session: { sessionId: string; userId: string; scenarioId: string } }
      error: null
    }
    expect(startBody.error).toBeNull()
    const sessionId = startBody.data.session.sessionId

    const historyBeforeResetRes = await fetch(`${APP_URL}/v1/conversations/${sessionId}/history`, {
      method: 'GET',
      headers: { 'x-api-key': API_KEY },
    })
    expect(historyBeforeResetRes.status).toBe(200)
    const historyBeforeResetBody = (await historyBeforeResetRes.json()) as {
      data: {
        session: { sessionId: string; userId: string; scenarioId: string }
        messages: unknown[]
      }
      error: null
    }
    expect(historyBeforeResetBody.error).toBeNull()
    expect(historyBeforeResetBody.data.session.sessionId).toBe(sessionId)
    expect(historyBeforeResetBody.data.session.userId).toBe(userId)
    expect(historyBeforeResetBody.data.messages).toEqual([])

    const resetRes = await fetch(`${APP_URL}/v1/conversations/${sessionId}`, {
      method: 'DELETE',
      headers: { 'x-api-key': API_KEY },
    })
    expect(resetRes.status).toBe(200)
    const resetBody = (await resetRes.json()) as {
      data: { sessionId: string; deleted: { messages: number } }
      error: null
    }
    expect(resetBody.error).toBeNull()
    expect(resetBody.data.sessionId).toBe(sessionId)
    expect(resetBody.data.deleted.messages).toBe(0)

    const historyAfterResetRes = await fetch(`${APP_URL}/v1/conversations/${sessionId}/history`, {
      method: 'GET',
      headers: { 'x-api-key': API_KEY },
    })
    expect(historyAfterResetRes.status).toBe(200)
    const historyAfterResetBody = (await historyAfterResetRes.json()) as {
      data: { session: { sessionId: string }; messages: unknown[] }
      error: null
    }
    expect(historyAfterResetBody.error).toBeNull()
    expect(historyAfterResetBody.data.session.sessionId).toBe(sessionId)
    expect(historyAfterResetBody.data.messages).toEqual([])
  })
})

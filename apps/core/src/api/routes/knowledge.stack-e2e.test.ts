import { describe, expect, it } from 'vitest'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const API_KEY = 'e2e-stack-secret'

function authHeaders(apiKey = API_KEY): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-api-key': apiKey,
  }
}

describe('Stack E2E — knowledge routes — auth', () => {
  it('rejects create source with no API key (401)', async () => {
    const res = await fetch(`${APP_URL}/v1/knowledge-sources`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(401)
  })

  it('rejects retrieval query with wrong API key (401)', async () => {
    const res = await fetch(`${APP_URL}/v1/admin/knowledge/retrieval`, {
      method: 'POST',
      headers: authHeaders('wrong-key'),
      body: JSON.stringify({ scenarioId: 'scenario_1', query: 'test' }),
    })

    expect(res.status).toBe(401)
  })
})

describe('Stack E2E — knowledge routes — validation', () => {
  it('rejects create source with missing required fields (400)', async () => {
    const res = await fetch(`${APP_URL}/v1/knowledge-sources`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: 'Only Name' }),
    })

    expect(res.status).toBe(400)
  })

  it('rejects retrieval query with invalid knowledgeType enum in list filter (400)', async () => {
    const res = await fetch(
      `${APP_URL}/v1/scenarios/scenario_test/knowledge-sources?knowledgeType=invalid`,
      {
        method: 'GET',
        headers: { 'x-api-key': API_KEY },
      },
    )

    expect(res.status).toBe(400)
  })
})

describe('Stack E2E — knowledge routes — not found baseline', () => {
  it('returns 404 for unknown source on trigger ingestion', async () => {
    const res = await fetch(`${APP_URL}/v1/knowledge-sources/source_missing/ingest`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('returns 404 for unknown ingestion job', async () => {
    const res = await fetch(`${APP_URL}/v1/ingestion-jobs/job_missing`, {
      method: 'GET',
      headers: { 'x-api-key': API_KEY },
    })

    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('NOT_FOUND')
  })
})

// TODO(EPIC 5.1): Add full happy-path stack coverage for create/list/trigger/status/retrieval
// once deterministic ingestion fixtures are available in docker stack bootstrap.
describe.skip('Stack E2E — knowledge routes — happy path', () => {
  it('creates a source, triggers ingestion and retrieves typed data', () => {
    expect(true).toBe(true)
  })
})

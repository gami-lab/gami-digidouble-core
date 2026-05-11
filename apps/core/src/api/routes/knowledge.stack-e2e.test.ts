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

async function waitForJob(ingestionJobId: string): Promise<{ status: string }> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const res = await fetch(`${APP_URL}/v1/ingestion-jobs/${ingestionJobId}`, {
      method: 'GET',
      headers: { 'x-api-key': API_KEY },
    })
    if (res.status !== 200) throw new Error(`Failed to get ingestion job ${ingestionJobId}`)
    const body = (await res.json()) as { data: { ingestionJob: { status: string } } }
    const status = body.data.ingestionJob.status
    if (status === 'completed' || status === 'failed') return { status }
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  throw new Error(`Timed out waiting for job ${ingestionJobId}`)
}

describe('Stack E2E — knowledge routes — happy path', () => {
  it('creates source, triggers ingestion, and queries retrieval', async () => {
    const now = Date.now().toString()
    const createScenarioRes = await fetch(`${APP_URL}/v1/scenarios`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: `Knowledge scenario ${now}` }),
    })
    expect(createScenarioRes.status).toBe(201)
    const scenarioBody = (await createScenarioRes.json()) as {
      data: { scenario: { scenarioId: string } }
    }
    const actualScenarioId = scenarioBody.data.scenario.scenarioId

    const createSourceRes = await fetch(`${APP_URL}/v1/knowledge-sources`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        scenarioId: actualScenarioId,
        name: 'World lore',
        knowledgeType: 'world',
        format: 'text',
        uriOrPath: '/tmp/world-lore.txt',
        metadata: { inlineText: 'Kingdom history and timeline.' },
      }),
    })
    expect(createSourceRes.status).toBe(201)
    const createSourceBody = (await createSourceRes.json()) as {
      data: { source: { sourceId: string } }
    }
    const sourceId = createSourceBody.data.source.sourceId

    const triggerRes = await fetch(`${APP_URL}/v1/knowledge-sources/${sourceId}/ingest`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({}),
    })
    expect(triggerRes.status).toBe(202)
    const triggerBody = (await triggerRes.json()) as {
      data: { ingestionJob: { ingestionJobId: string } }
    }
    const ingestionJobId = triggerBody.data.ingestionJob.ingestionJobId

    const finalJob = await waitForJob(ingestionJobId)
    expect(finalJob.status).toBe('completed')

    const retrievalRes = await fetch(`${APP_URL}/v1/admin/knowledge/retrieval`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        scenarioId: actualScenarioId,
        query: 'timeline',
        limitPerType: 3,
      }),
    })
    expect(retrievalRes.status).toBe(200)
    const retrievalBody = (await retrievalRes.json()) as {
      data: { retrieval: { world: Array<{ content: string }> } }
    }
    expect(Array.isArray(retrievalBody.data.retrieval.world)).toBe(true)
    expect(retrievalBody.data.retrieval.world.length).toBeGreaterThan(0)
    expect(
      retrievalBody.data.retrieval.world.some((item) =>
        item.content.toLowerCase().includes('timeline'),
      ),
    ).toBe(true)
    for (const item of retrievalBody.data.retrieval.world) {
      expect(item.content.length).toBeLessThanOrEqual(803)
    }
  })
})

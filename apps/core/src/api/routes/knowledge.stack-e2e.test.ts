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

  it('rejects upload with missing API key (401)', async () => {
    const res = await fetch(`${APP_URL}/v1/knowledge-sources/upload`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
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

  it('rejects upload with unsupported file extension (400)', async () => {
    const content = Buffer.from('some data').toString('base64')
    const res = await fetch(`${APP_URL}/v1/knowledge-sources/upload`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        scenarioId: 'scenario_1',
        name: 'Bad file',
        knowledgeType: 'world',
        content,
        filename: 'document.docx',
      }),
    })

    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('rejects upload with missing required fields (400)', async () => {
    const res = await fetch(`${APP_URL}/v1/knowledge-sources/upload`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: 'Missing fields' }),
    })

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

async function ensureActiveKnowledgeCorpus(): Promise<void> {
  const res = await fetch(`${APP_URL}/v1/admin/knowledge/reindex`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({}),
  })
  expect([200, 202]).toContain(res.status)

  const body = (await res.json()) as {
    data: {
      operation: { reindexOperationId: string } | null
    }
  }
  const operationId = body.data.operation?.reindexOperationId
  if (operationId === undefined) return

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const statusRes = await fetch(`${APP_URL}/v1/admin/knowledge/reindex/${operationId}`, {
      method: 'GET',
      headers: { 'x-api-key': API_KEY },
    })
    expect(statusRes.status).toBe(200)
    const statusBody = (await statusRes.json()) as {
      data: {
        operation: { status: string; failureDetails?: string }
      }
    }
    const operation = statusBody.data.operation
    if (operation.status === 'completed') return
    if (operation.status === 'failed') {
      throw new Error(
        `Knowledge corpus reindex failed: ${operation.failureDetails ?? 'unknown failure'}`,
      )
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(`Timed out waiting for knowledge corpus reindex ${operationId}`)
}

async function seedReadyWorldKnowledgeSource(args: {
  visibleToAvatarIds?: string[]
  inlineText: string
}): Promise<{ scenarioId: string }> {
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
  const scenarioId = scenarioBody.data.scenario.scenarioId

  const createSourceRes = await fetch(`${APP_URL}/v1/knowledge-sources`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      scenarioId,
      name: 'World lore',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/tmp/world-lore.txt',
      metadata: { inlineText: args.inlineText },
      ...(args.visibleToAvatarIds !== undefined
        ? { visibleToAvatarIds: args.visibleToAvatarIds }
        : {}),
    }),
  })
  expect(createSourceRes.status).toBe(201)
  const createSourceBody = (await createSourceRes.json()) as {
    data: { source: { sourceId: string } }
  }
  const sourceId = createSourceBody.data.source.sourceId

  // A fresh stack has no active corpus yet. Reindex this source through the documented
  // lifecycle before exercising normal per-source ingestion.
  await ensureActiveKnowledgeCorpus()

  const triggerRes = await fetch(`${APP_URL}/v1/knowledge-sources/${sourceId}/ingest`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({}),
  })
  expect(triggerRes.status).toBe(202)
  const triggerBody = (await triggerRes.json()) as {
    data: { ingestionJob: { ingestionJobId: string } }
  }

  const finalJob = await waitForJob(triggerBody.data.ingestionJob.ingestionJobId)
  expect(finalJob.status).toBe('completed')

  return { scenarioId }
}

async function deleteScenario(scenarioId: string): Promise<void> {
  await fetch(`${APP_URL}/v1/scenarios/${scenarioId}`, {
    method: 'DELETE',
    headers: { 'x-api-key': API_KEY },
  })
}

describe('Stack E2E — knowledge routes — happy path', () => {
  it('creates source, triggers ingestion, and queries retrieval', async () => {
    const seeded = await seedReadyWorldKnowledgeSource({
      inlineText: 'Kingdom history and timeline.',
    })

    try {
      const retrievalRes = await fetch(`${APP_URL}/v1/admin/knowledge/retrieval`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          scenarioId: seeded.scenarioId,
          query: 'timeline',
          limitPerType: 3,
        }),
      })
      expect(retrievalRes.status).toBe(200)
      const retrievalBody = (await retrievalRes.json()) as {
        data: {
          retrieval: {
            world: Array<{
              content: string
              distance?: number
              similarity?: number
              embedding?: unknown
            }>
            trace: {
              outcome: string
              visibilityMode: string
              gmUnrestricted: boolean
              queryVectorCount: number
              timings: { queryEmbeddingMs?: number; vectorSearchMs?: number }
            }
          }
        }
      }
      const retrieval = retrievalBody.data.retrieval
      expect(Array.isArray(retrieval.world)).toBe(true)
      expect(retrieval.world.length).toBeGreaterThan(0)
      expect(retrieval.world.some((item) => item.content.toLowerCase().includes('timeline'))).toBe(
        true,
      )
      expect(retrieval.trace).toMatchObject({
        outcome: 'success',
        visibilityMode: 'gm_unrestricted',
        gmUnrestricted: true,
        queryVectorCount: 1,
      })
      expect(typeof retrieval.trace.timings.queryEmbeddingMs).toBe('number')
      expect(typeof retrieval.trace.timings.vectorSearchMs).toBe('number')
      for (const item of retrieval.world) {
        expect(item.content.length).toBeLessThanOrEqual(803)
        expect(typeof item.distance).toBe('number')
        expect(typeof item.similarity).toBe('number')
        expect(item).not.toHaveProperty('embedding')
      }
    } finally {
      await deleteScenario(seeded.scenarioId)
    }
  })

  it('applies activeAvatarId visibility filtering deterministically', async () => {
    const seeded = await seedReadyWorldKnowledgeSource({
      visibleToAvatarIds: ['avatar_world_1'],
      inlineText: 'Avatar one private timeline marker.',
    })

    try {
      const visibleRes = await fetch(`${APP_URL}/v1/admin/knowledge/retrieval`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          scenarioId: seeded.scenarioId,
          query: 'timeline marker',
          activeAvatarId: 'avatar_world_1',
        }),
      })
      expect(visibleRes.status).toBe(200)
      const visibleBody = (await visibleRes.json()) as {
        data: { retrieval: { world: Array<{ chunkId: string }> } }
      }

      const hiddenRes = await fetch(`${APP_URL}/v1/admin/knowledge/retrieval`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          scenarioId: seeded.scenarioId,
          query: 'timeline marker',
          activeAvatarId: 'avatar_world_2',
        }),
      })
      expect(hiddenRes.status).toBe(200)
      const hiddenBody = (await hiddenRes.json()) as {
        data: { retrieval: { world: Array<{ chunkId: string }> } }
      }

      expect(visibleBody.data.retrieval.world.length).toBeGreaterThan(0)
      expect(hiddenBody.data.retrieval.world).toEqual([])
    } finally {
      await deleteScenario(seeded.scenarioId)
    }
  })
})

describe('Stack E2E — knowledge upload — happy path', () => {
  it('uploads a TXT file, ingests it, and retrieves the extracted content', async () => {
    const now = Date.now().toString()
    const createScenarioRes = await fetch(`${APP_URL}/v1/scenarios`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: `Upload scenario ${now}` }),
    })
    expect(createScenarioRes.status).toBe(201)
    const scenarioBody = (await createScenarioRes.json()) as {
      data: { scenario: { scenarioId: string } }
    }
    const scenarioId = scenarioBody.data.scenario.scenarioId

    try {
      const content = Buffer.from('Uploaded lore mentions a hidden lakeside passage.').toString(
        'base64',
      )
      const uploadRes = await fetch(`${APP_URL}/v1/knowledge-sources/upload`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          scenarioId,
          name: 'Uploaded lore',
          knowledgeType: 'world',
          content,
          filename: 'lore.txt',
        }),
      })
      expect(uploadRes.status).toBe(201)
      const uploadBody = (await uploadRes.json()) as { data: { source: { sourceId: string } } }
      const sourceId = uploadBody.data.source.sourceId

      await ensureActiveKnowledgeCorpus()

      const triggerRes = await fetch(`${APP_URL}/v1/knowledge-sources/${sourceId}/ingest`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({}),
      })
      expect(triggerRes.status).toBe(202)
      const triggerBody = (await triggerRes.json()) as {
        data: { ingestionJob: { ingestionJobId: string } }
      }

      const finalJob = await waitForJob(triggerBody.data.ingestionJob.ingestionJobId)
      expect(finalJob.status).toBe('completed')

      const retrievalRes = await fetch(`${APP_URL}/v1/admin/knowledge/retrieval`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ scenarioId, query: 'lakeside passage' }),
      })
      expect(retrievalRes.status).toBe(200)
      const retrievalBody = (await retrievalRes.json()) as {
        data: { retrieval: { world: Array<{ content: string }> } }
      }
      expect(
        retrievalBody.data.retrieval.world.some((item) =>
          item.content.toLowerCase().includes('lakeside passage'),
        ),
      ).toBe(true)
    } finally {
      await deleteScenario(scenarioId)
    }
  })
})

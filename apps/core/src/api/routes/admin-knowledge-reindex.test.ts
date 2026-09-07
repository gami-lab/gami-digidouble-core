import { afterEach, describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import type {
  EmbeddingBatchRequest,
  EmbeddingBatchResult,
  IEmbeddingAdapter,
} from '../../application/ports/IEmbeddingAdapter.js'
import type { FastifyInstance } from 'fastify'
import { InMemoryEventLogRepository } from '../../infrastructure/db/in-memory-event-log.repository.js'
import { InMemoryKnowledgeChunkRepository } from '../../infrastructure/db/in-memory-knowledge-chunk.repository.js'
import { InMemoryKnowledgeCorpusRepository } from '../../infrastructure/db/in-memory-knowledge-corpus.repository.js'
import { InMemoryKnowledgeSourceContentLoader } from '../../infrastructure/knowledge/in-memory-knowledge-source-content-loader.js'
import { InMemoryKnowledgeSourceRepository } from '../../infrastructure/db/in-memory-knowledge-source.repository.js'
import { createServer } from '../server.js'
import { TEST_CONFIG } from './test-config.js'

const targetProfile = {
  provider: TEST_CONFIG.embeddingProvider,
  model: TEST_CONFIG.embeddingModel,
  dimensions: TEST_CONFIG.embeddingDimensions,
}

const previousCorpus = {
  corpusGenerationId: 'corpus_generation_previous',
  embeddingProfileId: 'embedding_profile_previous',
  profile: { provider: 'old-provider', model: 'old-model', dimensions: 16 },
} as const

class TestEmbeddingAdapter implements IEmbeddingAdapter {
  calls = 0

  constructor(private readonly failFirst = false) {}

  embed(request: EmbeddingBatchRequest): Promise<EmbeddingBatchResult> {
    this.calls += 1
    if (this.failFirst && this.calls === 1)
      return Promise.reject(new Error('temporary provider failure'))
    return Promise.resolve({
      vectors: request.inputs.map(() =>
        Array.from({ length: targetProfile.dimensions }, () => 0.1),
      ),
      metadata: { profile: targetProfile, inputCount: request.inputs.length, batchCount: 1 },
    })
  }
}

const apps: FastifyInstance[] = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
})

async function makeApp(adapter = new TestEmbeddingAdapter()) {
  const sourceRepository = new InMemoryKnowledgeSourceRepository()
  await sourceRepository.create({
    scenarioId: 'scenario_1',
    name: 'Reindex source',
    knowledgeType: 'world',
    format: 'text',
    uriOrPath: 'inline://reindex',
    metadata: { inlineText: 'Reindexable source content.' },
  })
  const chunkRepository = new InMemoryKnowledgeChunkRepository()
  const corpusRepository = new InMemoryKnowledgeCorpusRepository(chunkRepository, previousCorpus)
  const app = createServer(TEST_CONFIG, {
    knowledgeSourceRepository: sourceRepository,
    knowledgeChunkRepository: chunkRepository,
    knowledgeCorpusRepository: corpusRepository,
    knowledgeSourceContentLoader: new InMemoryKnowledgeSourceContentLoader(),
    embeddingAdapter: adapter,
    eventLogRepository: new InMemoryEventLogRepository(),
  })
  apps.push(app)
  return { app, adapter }
}

function authHeaders(apiKey = 'test-secret'): { 'x-api-key': string } {
  return { 'x-api-key': apiKey }
}

async function waitForOperation(app: FastifyInstance, operationId: string, status: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await app.inject({
      method: 'GET',
      url: `/v1/admin/knowledge/reindex/${operationId}`,
      headers: authHeaders(),
    })
    const body =
      response.json<
        ApiResponse<{ operation: { status: string }; sources: Array<{ status: string }> }>
      >()
    if (body.data?.operation.status === status) return body.data
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  throw new Error(`Timed out waiting for ${status}`)
}

/* eslint-disable max-lines-per-function */
describe('Admin knowledge reindex routes', () => {
  it('requires auth on start', async () => {
    const { app } = await makeApp()
    await expect(
      app.inject({ method: 'POST', url: '/v1/admin/knowledge/reindex', payload: {} }),
    ).resolves.toMatchObject({ statusCode: 401 })
    await expect(
      app.inject({
        method: 'POST',
        url: '/v1/admin/knowledge/reindex',
        headers: { 'x-api-key': 'wrong-secret' },
        payload: {},
      }),
    ).resolves.toMatchObject({ statusCode: 401 })
  })

  it('requires auth on status', async () => {
    const { app } = await makeApp()
    await expect(
      app.inject({
        method: 'GET',
        url: '/v1/admin/knowledge/reindex/reindex_operation_missing',
      }),
    ).resolves.toMatchObject({ statusCode: 401 })
    await expect(
      app.inject({
        method: 'GET',
        url: '/v1/admin/knowledge/reindex/reindex_operation_missing',
        headers: { 'x-api-key': 'wrong-secret' },
      }),
    ).resolves.toMatchObject({ statusCode: 401 })
  })

  it('requires auth on retry', async () => {
    const { app } = await makeApp()
    await expect(
      app.inject({
        method: 'POST',
        url: '/v1/admin/knowledge/reindex/reindex_operation_missing/retry',
        payload: {},
      }),
    ).resolves.toMatchObject({ statusCode: 401 })
    await expect(
      app.inject({
        method: 'POST',
        url: '/v1/admin/knowledge/reindex/reindex_operation_missing/retry',
        headers: { 'x-api-key': 'wrong-secret' },
        payload: {},
      }),
    ).resolves.toMatchObject({ statusCode: 401 })
  })

  it('validates input and returns not found envelopes', async () => {
    const { app } = await makeApp()
    const invalid = await app.inject({
      method: 'POST',
      url: '/v1/admin/knowledge/reindex',
      headers: authHeaders(),
      payload: { unexpected: true },
    })
    expect(invalid.statusCode).toBe(400)

    const missing = await app.inject({
      method: 'GET',
      url: '/v1/admin/knowledge/reindex/reindex_operation_00000000-0000-0000-0000-000000000000',
      headers: authHeaders(),
    })
    expect(missing.statusCode).toBe(404)
    expect(missing.json<ApiResponse<null>>().error?.code).toBe('NOT_FOUND')
  })

  it('starts, reports, and completes a full replacement operation', async () => {
    const { app } = await makeApp()
    const started = await app.inject({
      method: 'POST',
      url: '/v1/admin/knowledge/reindex',
      headers: authHeaders(),
      payload: {},
    })
    expect(started.statusCode).toBe(202)
    const startedBody =
      started.json<
        ApiResponse<{ status: string; operation: { reindexOperationId: string } | null }>
      >()
    const operationId = startedBody.data?.operation?.reindexOperationId
    expect(operationId).toBeTypeOf('string')
    if (operationId === undefined) return

    const completed = await waitForOperation(app, operationId, 'completed')
    expect(completed.sources).toEqual([expect.objectContaining({ status: 'completed' })])

    const alreadyActive = await app.inject({
      method: 'POST',
      url: '/v1/admin/knowledge/reindex',
      headers: authHeaders(),
      payload: {},
    })
    expect(alreadyActive.statusCode).toBe(200)
    expect(alreadyActive.json<ApiResponse<{ status: string }>>().data?.status).toBe(
      'already_active',
    )
  })

  it('retries a failed operation and exposes the completed result', async () => {
    const { app, adapter } = await makeApp(new TestEmbeddingAdapter(true))
    const started = await app.inject({
      method: 'POST',
      url: '/v1/admin/knowledge/reindex',
      headers: authHeaders(),
      payload: {},
    })
    const operationId =
      started.json<ApiResponse<{ operation: { reindexOperationId: string } }>>().data?.operation
        .reindexOperationId
    expect(operationId).toBeTypeOf('string')
    if (operationId === undefined) return

    await waitForOperation(app, operationId, 'failed')
    const retry = await app.inject({
      method: 'POST',
      url: `/v1/admin/knowledge/reindex/${operationId}/retry`,
      headers: authHeaders(),
      payload: {},
    })
    expect(retry.statusCode).toBe(202)
    await waitForOperation(app, operationId, 'completed')
    expect(adapter.calls).toBe(2)
  })
})
/* eslint-enable max-lines-per-function */

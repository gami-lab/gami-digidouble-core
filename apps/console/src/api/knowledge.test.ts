import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CreateKnowledgeSourceResponse, QueryKnowledgeRetrievalResponse } from '@gami/shared'
import { coreRequest } from './client'
import {
  createKnowledgeSource,
  getIngestionJob,
  listIngestionJobs,
  listKnowledgeSources,
  queryKnowledgeRetrieval,
  triggerIngestion,
} from './knowledge'

vi.mock('./client', () => ({
  coreRequest: vi.fn(),
}))

describe('knowledge API wrappers - source operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates and lists knowledge sources with shared DTOs', async () => {
    const createPayload: CreateKnowledgeSourceResponse = {
      source: {
        sourceId: 'source_1',
        scenarioId: 'scenario_1',
        name: 'Lore',
        knowledgeType: 'world',
        format: 'markdown',
        uriOrPath: '/docs/lore.md',
        status: 'pending',
        createdAt: '2026-05-11T12:00:00.000Z',
      },
    }
    vi.mocked(coreRequest)
      .mockResolvedValueOnce(createPayload)
      .mockResolvedValueOnce({
        sources: [createPayload.source],
      })

    const created = await createKnowledgeSource({
      scenarioId: 'scenario_1',
      name: 'Lore',
      knowledgeType: 'world',
      format: 'markdown',
      uriOrPath: '/docs/lore.md',
      visibleToAvatarIds: ['avatar_1'],
    })
    const listed = await listKnowledgeSources('scenario_1', { knowledgeType: 'world' })

    expect(coreRequest).toHaveBeenNthCalledWith(1, 'POST', '/v1/knowledge-sources', {
      scenarioId: 'scenario_1',
      name: 'Lore',
      knowledgeType: 'world',
      format: 'markdown',
      uriOrPath: '/docs/lore.md',
      visibleToAvatarIds: ['avatar_1'],
    })
    expect(coreRequest).toHaveBeenNthCalledWith(
      2,
      'GET',
      '/v1/scenarios/scenario_1/knowledge-sources?knowledgeType=world',
    )
    expect(created.source.sourceId).toBe('source_1')
    expect(listed.sources).toHaveLength(1)
  })
})

describe('knowledge API wrappers - ingestion operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('triggers ingestion and queries job status/history', async () => {
    vi.mocked(coreRequest)
      .mockResolvedValueOnce({
        scheduled: true,
        ingestionJob: {
          ingestionJobId: 'job_1',
          sourceId: 'source_1',
          status: 'queued',
          attempts: 0,
          createdAt: '2026-05-11T12:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({ jobs: [] })
      .mockResolvedValueOnce({
        ingestionJob: {
          ingestionJobId: 'job_1',
          sourceId: 'source_1',
          status: 'running',
          attempts: 1,
          createdAt: '2026-05-11T12:00:00.000Z',
        },
      })

    await triggerIngestion('source_1', { correlationId: 'corr_1' })
    await listIngestionJobs('source_1')
    await getIngestionJob('job_1')

    expect(coreRequest).toHaveBeenNthCalledWith(
      1,
      'POST',
      '/v1/knowledge-sources/source_1/ingest',
      { correlationId: 'corr_1' },
    )
    expect(coreRequest).toHaveBeenNthCalledWith(
      2,
      'GET',
      '/v1/knowledge-sources/source_1/ingestion-jobs',
    )
    expect(coreRequest).toHaveBeenNthCalledWith(3, 'GET', '/v1/ingestion-jobs/job_1')
  })
})

describe('knowledge API wrappers - retrieval operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queries typed retrieval diagnostics through admin endpoint', async () => {
    const payload: QueryKnowledgeRetrievalResponse = {
      retrieval: {
        memory: [],
        world: [],
        media: [],
        trace: {
          query: 'q',
          perType: {
            memory: { sourceIds: [], selectedChunkIds: [] },
            world: { sourceIds: [], selectedChunkIds: [] },
            media: { sourceIds: [], selectedChunkIds: [] },
          },
        },
      },
    }
    vi.mocked(coreRequest).mockResolvedValue(payload)

    const result = await queryKnowledgeRetrieval({
      scenarioId: 'scenario_1',
      query: 'hero backstory',
      sessionId: 'session_1',
      activeAvatarId: 'avatar_1',
      limitPerType: 3,
    })

    expect(coreRequest).toHaveBeenCalledWith('POST', '/v1/admin/knowledge/retrieval', {
      scenarioId: 'scenario_1',
      query: 'hero backstory',
      sessionId: 'session_1',
      activeAvatarId: 'avatar_1',
      limitPerType: 3,
    })
    expect(result.retrieval.trace.query).toBe('q')
  })
})

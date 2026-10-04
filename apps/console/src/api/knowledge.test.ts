import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { QueryKnowledgeRetrievalResponse } from '@gami/shared'
import { coreRequest } from './client'
import {
  listIngestionJobs,
  listKnowledgeChunks,
  listKnowledgeSources,
  queryKnowledgeRetrieval,
} from './knowledge'

vi.mock('./client', () => ({
  coreRequest: vi.fn(),
}))

describe('knowledge API wrappers - read operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads sources, ingestion jobs, and chunks from canonical routes', async () => {
    vi.mocked(coreRequest).mockResolvedValue({})

    await listKnowledgeSources('scenario_1')
    await listIngestionJobs('source_1')
    await listKnowledgeChunks('source_1')

    expect(coreRequest).toHaveBeenNthCalledWith(
      1,
      'GET',
      '/v1/scenarios/scenario_1/knowledge-sources',
    )
    expect(coreRequest).toHaveBeenNthCalledWith(
      2,
      'GET',
      '/v1/knowledge-sources/source_1/ingestion-jobs',
    )
    expect(coreRequest).toHaveBeenNthCalledWith(3, 'GET', '/v1/knowledge-sources/source_1/chunks')
  })
})

describe('knowledge API wrappers - retrieval operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queries typed retrieval diagnostics through admin endpoint', async () => {
    const payload: QueryKnowledgeRetrievalResponse = {
      retrieval: {
        avatar_knowledge: [],
        world: [],
        media: [],
        trace: {
          query: 'q',
          perType: {
            avatar_knowledge: { sourceIds: [], selectedChunkIds: [] },
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
      activeAvatarId: 'avatar_1',
      limitPerType: 3,
    })

    expect(coreRequest).toHaveBeenCalledWith('POST', '/v1/admin/knowledge/retrieval', {
      scenarioId: 'scenario_1',
      query: 'hero backstory',
      activeAvatarId: 'avatar_1',
      limitPerType: 3,
    })
    expect(result.retrieval.trace.query).toBe('q')
  })
})

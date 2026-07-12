import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { KnowledgeSourceDto } from '@gami/shared'
import { adminRequest } from './client'
import {
  createKnowledgeSource,
  deleteKnowledgeSource,
  getIngestionJob,
  listIngestionJobs,
  listKnowledgeChunks,
  listKnowledgeSources,
  queryKnowledgeRetrieval,
  triggerIngestion,
  updateKnowledgeSource,
  uploadKnowledgeSource,
} from './knowledge'

vi.mock('./client', () => ({
  adminRequest: vi.fn(),
}))

function makeSource(): KnowledgeSourceDto {
  return {
    sourceId: 'source_1',
    scenarioId: 'scenario_1',
    name: 'World lore',
    knowledgeType: 'world',
    format: 'text',
    uriOrPath: '/tmp/world-lore.txt',
    status: 'pending',
    createdAt: '2026-07-01T00:00:00.000Z',
  }
}

describe('knowledge API wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists knowledge sources for a scenario', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ sources: [makeSource()] })

    const result = await listKnowledgeSources('scenario_1')

    expect(adminRequest).toHaveBeenCalledWith('GET', '/v1/scenarios/scenario_1/knowledge-sources')
    expect(result).toHaveLength(1)
  })

  it('creates a knowledge source', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ source: makeSource() })

    await createKnowledgeSource({
      scenarioId: 'scenario_1',
      name: 'World lore',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/tmp/world-lore.txt',
      visibilityPolicy: 'avatars',
      visibleToAvatarIds: ['avatar_1'],
    })

    expect(adminRequest).toHaveBeenCalledWith('POST', '/v1/knowledge-sources', {
      scenarioId: 'scenario_1',
      name: 'World lore',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/tmp/world-lore.txt',
      visibilityPolicy: 'avatars',
      visibleToAvatarIds: ['avatar_1'],
    })
  })

  it('uploads a knowledge source file', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ source: makeSource() })

    await uploadKnowledgeSource({
      scenarioId: 'scenario_1',
      name: 'Uploaded',
      knowledgeType: 'world',
      content: 'base64content',
      filename: 'lore.txt',
      visibilityPolicy: 'avatars',
      visibleToAvatarIds: ['avatar_1'],
    })

    expect(adminRequest).toHaveBeenCalledWith('POST', '/v1/knowledge-sources/upload', {
      scenarioId: 'scenario_1',
      name: 'Uploaded',
      knowledgeType: 'world',
      content: 'base64content',
      filename: 'lore.txt',
      visibilityPolicy: 'avatars',
      visibleToAvatarIds: ['avatar_1'],
    })
  })

  it('updates a knowledge source', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ source: makeSource() })

    await updateKnowledgeSource('source_1', {
      visibilityPolicy: 'avatars',
      visibleToAvatarIds: ['avatar_1'],
    })

    expect(adminRequest).toHaveBeenCalledWith('PATCH', '/v1/knowledge-sources/source_1', {
      visibilityPolicy: 'avatars',
      visibleToAvatarIds: ['avatar_1'],
    })
  })

  it('deletes a knowledge source', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ sourceId: 'source_1', deleted: true })

    await deleteKnowledgeSource('source_1')

    expect(adminRequest).toHaveBeenCalledWith('DELETE', '/v1/knowledge-sources/source_1')
  })

  it('triggers ingestion for a source', async () => {
    vi.mocked(adminRequest).mockResolvedValue({
      scheduled: true,
      ingestionJob: {
        ingestionJobId: 'job_1',
        sourceId: 'source_1',
        status: 'queued',
        attempts: 0,
        createdAt: '2026-07-01T00:00:00.000Z',
      },
    })

    const result = await triggerIngestion('source_1')

    expect(adminRequest).toHaveBeenCalledWith('POST', '/v1/knowledge-sources/source_1/ingest', {})
    expect(result.ingestionJobId).toBe('job_1')
  })
})

describe('knowledge ingestion inspection and retrieval API wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('gets a single ingestion job', async () => {
    vi.mocked(adminRequest).mockResolvedValue({
      ingestionJob: {
        ingestionJobId: 'job_1',
        sourceId: 'source_1',
        status: 'completed',
        attempts: 1,
        createdAt: '2026-07-01T00:00:00.000Z',
      },
    })

    const result = await getIngestionJob('job_1')

    expect(adminRequest).toHaveBeenCalledWith('GET', '/v1/ingestion-jobs/job_1')
    expect(result.status).toBe('completed')
  })

  it('lists ingestion jobs for a source', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ jobs: [] })

    const result = await listIngestionJobs('source_1')

    expect(adminRequest).toHaveBeenCalledWith(
      'GET',
      '/v1/knowledge-sources/source_1/ingestion-jobs',
    )
    expect(result).toEqual([])
  })

  it('lists ingested chunks for a source', async () => {
    vi.mocked(adminRequest).mockResolvedValue({ chunks: [] })

    const result = await listKnowledgeChunks('source_1')

    expect(adminRequest).toHaveBeenCalledWith('GET', '/v1/knowledge-sources/source_1/chunks')
    expect(result).toEqual([])
  })

  it('queries typed knowledge retrieval', async () => {
    const retrieval = {
      memory: [],
      world: [],
      media: [],
      trace: { query: 'hello', perType: {} },
    }
    vi.mocked(adminRequest).mockResolvedValue({ retrieval })

    const result = await queryKnowledgeRetrieval({ scenarioId: 'scenario_1', query: 'hello' })

    expect(adminRequest).toHaveBeenCalledWith('POST', '/v1/admin/knowledge/retrieval', {
      scenarioId: 'scenario_1',
      query: 'hello',
    })
    expect(result).toEqual(retrieval)
  })
})

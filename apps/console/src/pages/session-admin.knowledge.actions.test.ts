import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createKnowledgeSource,
  listIngestionJobs,
  listKnowledgeSources,
  queryKnowledgeRetrieval,
  triggerIngestion,
} from '../api/knowledge'
import {
  inspectRetrieval,
  refreshKnowledgeSources,
  registerAndIngestSource,
} from './session-admin-knowledge'

vi.mock('../api/knowledge', () => ({
  createKnowledgeSource: vi.fn(),
  triggerIngestion: vi.fn(),
  listIngestionJobs: vi.fn(),
  listKnowledgeSources: vi.fn(),
  queryKnowledgeRetrieval: vi.fn(),
}))

describe('session admin knowledge actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers, triggers ingestion, and publishes operator summary', async () => {
    vi.mocked(createKnowledgeSource).mockResolvedValue({
      source: {
        sourceId: 'source_1',
        scenarioId: 'scenario_1',
        name: 'Lore',
        knowledgeType: 'world',
        format: 'markdown',
        uriOrPath: '/lore.md',
        status: 'pending',
        createdAt: '2026-05-11T00:00:00.000Z',
      },
    })
    vi.mocked(triggerIngestion).mockResolvedValue({
      scheduled: true,
      ingestionJob: {
        ingestionJobId: 'job_1',
        sourceId: 'source_1',
        status: 'queued',
        attempts: 0,
        createdAt: '2026-05-11T00:00:00.000Z',
      },
    })
    vi.mocked(listIngestionJobs).mockResolvedValue({ jobs: [] })

    const setStatus = vi.fn()
    const setError = vi.fn()
    const setSourcesSummary = vi.fn()
    const setName = vi.fn()
    const setUriOrPath = vi.fn()

    await registerAndIngestSource(
      {
        scenarioId: 'scenario_1',
        name: 'Lore',
        uriOrPath: '/lore.md',
        knowledgeType: 'world',
        format: 'markdown',
      },
      { setStatus, setError, setSourcesSummary, setName, setUriOrPath },
    )

    expect(createKnowledgeSource).toHaveBeenCalled()
    expect(triggerIngestion).toHaveBeenCalledWith('source_1')
    expect(setStatus).toHaveBeenCalledWith('Registered source_1 and scheduled job_1.')
    expect(setSourcesSummary).toHaveBeenCalledWith('Source Lore (world/markdown) · jobs: 0.')
  })

  it('lists sources and summarizes statuses', async () => {
    vi.mocked(listKnowledgeSources).mockResolvedValue({
      sources: [
        {
          sourceId: 'source_1',
          scenarioId: 'scenario_1',
          name: 'Lore',
          knowledgeType: 'world',
          format: 'markdown',
          uriOrPath: '/lore.md',
          status: 'ready',
          createdAt: '2026-05-11T00:00:00.000Z',
        },
      ],
    })

    const setSummary = vi.fn()
    const setError = vi.fn()
    await refreshKnowledgeSources('scenario_1', setSummary, setError)

    expect(setSummary).toHaveBeenCalledWith('Knowledge sources: Lore [ready]')
  })

  it('inspects retrieval diagnostics summary', async () => {
    vi.mocked(queryKnowledgeRetrieval).mockResolvedValue({
      retrieval: {
        memory: [{ sourceId: 's', chunkId: 'c', knowledgeType: 'memory', content: 'm' }],
        world: [],
        media: [{ sourceId: 's2', chunkId: 'c2', knowledgeType: 'media', content: 'x' }],
        trace: {
          query: 'runtime_inspector_probe',
          perType: {
            memory: { sourceIds: ['s'], selectedChunkIds: ['c'] },
            world: { sourceIds: [], selectedChunkIds: [] },
            media: { sourceIds: ['s2'], selectedChunkIds: ['c2'] },
          },
        },
      },
    })

    const setSummary = vi.fn()
    const setError = vi.fn()
    await inspectRetrieval('session_1', 'conversation_1', 'scenario_1', setSummary, setError)

    expect(queryKnowledgeRetrieval).toHaveBeenCalled()
    expect(setSummary).toHaveBeenCalledWith('retrieval: memory=1, world=0, media=1.')
  })
})

import { describe, expect, it } from 'vitest'
import type {
  EmbeddingBatchRequest,
  EmbeddingBatchResult,
  EmbeddingProfile,
  IEmbeddingAdapter,
} from '../../ports/IEmbeddingAdapter.js'
import { InMemoryEventLogRepository } from '../../../infrastructure/db/in-memory-event-log.repository.js'
import { InMemoryKnowledgeChunkRepository } from '../../../infrastructure/db/in-memory-knowledge-chunk.repository.js'
import { InMemoryKnowledgeCorpusRepository } from '../../../infrastructure/db/in-memory-knowledge-corpus.repository.js'
import { InMemoryKnowledgeSourceContentLoader } from '../../../infrastructure/knowledge/in-memory-knowledge-source-content-loader.js'
import { InMemoryKnowledgeSourceRepository } from '../../../infrastructure/db/in-memory-knowledge-source.repository.js'
import { KnowledgeReindexService } from './knowledge-reindex.service.js'

const targetProfile: EmbeddingProfile = {
  provider: 'test-provider',
  model: 'test-model-v2',
  dimensions: 2,
}

const previousCorpus = {
  corpusGenerationId: 'corpus_generation_previous',
  embeddingProfileId: 'embedding_profile_previous',
  profile: {
    provider: 'test-provider',
    model: 'test-model-v1',
    dimensions: 2,
  },
} as const

class CountingEmbeddingAdapter implements IEmbeddingAdapter {
  calls = 0

  constructor(private readonly failFirst = false) {}

  embed(request: EmbeddingBatchRequest): Promise<EmbeddingBatchResult> {
    this.calls += 1
    if (this.failFirst && this.calls === 1) {
      return Promise.reject(new Error('provider unavailable'))
    }
    return Promise.resolve({
      vectors: request.inputs.map((_input, index) => [index + 1, 1]),
      metadata: {
        profile: targetProfile,
        inputCount: request.inputs.length,
        batchCount: 1,
      },
    })
  }
}

async function makeService(adapter = new CountingEmbeddingAdapter()) {
  const sourceRepository = new InMemoryKnowledgeSourceRepository()
  await sourceRepository.create({
    scenarioId: 'scenario_1',
    name: 'First source',
    knowledgeType: 'world',
    format: 'text',
    uriOrPath: 'inline://first',
    metadata: { inlineText: 'first source content' },
  })
  await sourceRepository.create({
    scenarioId: 'scenario_1',
    name: 'Second source',
    knowledgeType: 'world',
    format: 'text',
    uriOrPath: 'inline://second',
    metadata: { inlineText: 'second source content' },
  })
  const chunks = new InMemoryKnowledgeChunkRepository()
  const corpusRepository = new InMemoryKnowledgeCorpusRepository(chunks, previousCorpus)
  const sourceContentLoader = new InMemoryKnowledgeSourceContentLoader()
  const eventLogRepository = new InMemoryEventLogRepository()
  const service = new KnowledgeReindexService(
    sourceRepository,
    corpusRepository,
    sourceContentLoader,
    adapter,
    eventLogRepository,
    targetProfile,
    1000,
  )
  return {
    service,
    corpusRepository,
    adapter,
    sourceRepository,
    sourceContentLoader,
    eventLogRepository,
  }
}

describe('KnowledgeReindexService', () => {
  it('stages every source and promotes only the complete target corpus', async () => {
    const { service, corpusRepository } = await makeService()

    const started = await service.start()
    expect(started.status).toBe('started')
    expect(started.operation?.expectedSourceCount).toBe(2)
    await service.run(started.operation?.reindexOperationId ?? '')

    const operation = await corpusRepository.findReindexOperation(
      started.operation?.reindexOperationId ?? '',
    )
    const active = await corpusRepository.getActiveCorpus()
    expect(operation?.status).toBe('completed')
    expect(active?.profile).toMatchObject(targetProfile)
    expect(
      await corpusRepository.listReindexSourceProgress(operation?.reindexOperationId ?? ''),
    ).toHaveLength(2)
    expect(
      await corpusRepository.listActiveChunksBySourceIds(['missing-source-is-not-used']),
    ).toEqual([])
  })

  // eslint-disable-next-line complexity
  it('reuses duplicate starts and retries failed sources without replacing the old corpus', async () => {
    const adapter = new CountingEmbeddingAdapter(true)
    const { service, corpusRepository } = await makeService(adapter)
    const first = await service.start()
    const duplicate = await service.start()
    expect(duplicate.operation?.reindexOperationId).toBe(first.operation?.reindexOperationId)

    await Promise.all([
      service.run(first.operation?.reindexOperationId ?? ''),
      service.run(first.operation?.reindexOperationId ?? ''),
    ])
    const failed = await corpusRepository.findReindexOperation(
      first.operation?.reindexOperationId ?? '',
    )
    expect(failed?.status).toBe('failed')
    expect((await corpusRepository.getActiveCorpus())?.corpusGenerationId).toBe(
      previousCorpus.corpusGenerationId,
    )

    await service.run(first.operation?.reindexOperationId ?? '')
    const completed = await corpusRepository.findReindexOperation(
      first.operation?.reindexOperationId ?? '',
    )
    expect(completed?.status).toBe('completed')
    expect(completed?.attempts).toBe(2)
    expect(adapter.calls).toBe(3)
  })

  it('does not start an operation when the configured profile is already active', async () => {
    const { corpusRepository, sourceRepository, sourceContentLoader, adapter, eventLogRepository } =
      await makeService()
    const alreadyActive = new KnowledgeReindexService(
      sourceRepository,
      corpusRepository,
      sourceContentLoader,
      adapter,
      eventLogRepository,
      previousCorpus.profile,
    )
    const result = await alreadyActive.start()
    expect(result.status).toBe('already_active')
    expect(result.operation).toBeNull()
  })

  it('recovers an interrupted operation and resumes it deterministically', async () => {
    const { service, corpusRepository } = await makeService()
    const started = await service.start()
    const operationId = started.operation?.reindexOperationId ?? ''

    await corpusRepository.claimReindexOperation(operationId)
    await expect(corpusRepository.findReindexOperation(operationId)).resolves.toMatchObject({
      status: 'running',
    })
    await expect(corpusRepository.recoverRunningReindexOperations()).resolves.toEqual([operationId])
    await expect(corpusRepository.findReindexOperation(operationId)).resolves.toMatchObject({
      status: 'failed',
      failureDetails: 'worker_interrupted: Reindex worker was interrupted.',
    })

    await service.run(operationId)

    await expect(corpusRepository.findReindexOperation(operationId)).resolves.toMatchObject({
      status: 'completed',
      attempts: 2,
    })
  })
})

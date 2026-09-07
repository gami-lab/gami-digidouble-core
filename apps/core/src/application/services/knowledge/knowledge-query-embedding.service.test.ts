import { describe, expect, it } from 'vitest'
import {
  EmbeddingAdapterError,
  type EmbeddingBatchResult,
  type IEmbeddingAdapter,
} from '../../ports/IEmbeddingAdapter.js'
import type { ActiveCorpus } from '../../ports/IKnowledgeCorpusRepository.js'
import { KnowledgeQueryEmbeddingService } from './knowledge-query-embedding.service.js'

const activeCorpus: ActiveCorpus = {
  corpusGenerationId: 'corpus_generation_active',
  embeddingProfileId: 'embedding_profile_active',
  profile: { provider: 'openai', model: 'text-embedding-3-small', dimensions: 3 },
}

class StubEmbeddingAdapter implements IEmbeddingAdapter {
  constructor(private readonly result: EmbeddingBatchResult) {}

  embed(): Promise<EmbeddingBatchResult> {
    return Promise.resolve(this.result)
  }
}

function result(vector: number[], profile = activeCorpus.profile): EmbeddingBatchResult {
  return {
    vectors: [vector],
    metadata: { profile, inputCount: 1, batchCount: 1 },
  }
}

describe('KnowledgeQueryEmbeddingService', () => {
  it('returns a copy-safe vector tagged with the active corpus identity', async () => {
    const service = new KnowledgeQueryEmbeddingService(
      { getActiveCorpus: () => Promise.resolve(activeCorpus) },
      new StubEmbeddingAdapter(result([1, 2, 3])),
    )

    const profiled = await service.embed('question')
    expect(profiled).toMatchObject({
      embeddingProfileId: activeCorpus.embeddingProfileId,
      corpusGenerationId: activeCorpus.corpusGenerationId,
      profile: activeCorpus.profile,
      vector: [1, 2, 3],
    })
    expect(Object.isFrozen(profiled.vector)).toBe(true)
  })

  it('rejects a provider result from a different profile', async () => {
    const service = new KnowledgeQueryEmbeddingService(
      { getActiveCorpus: () => Promise.resolve(activeCorpus) },
      new StubEmbeddingAdapter(
        result([1, 2, 3], { provider: 'openai', model: 'other-model', dimensions: 3 }),
      ),
    )

    await expect(service.embed('question')).rejects.toMatchObject({
      failure: { code: 'profile_mismatch', retryable: true },
    })
  })

  it('rejects a vector with the wrong dimension', async () => {
    const service = new KnowledgeQueryEmbeddingService(
      { getActiveCorpus: () => Promise.resolve(activeCorpus) },
      new StubEmbeddingAdapter(result([1, 2])),
    )

    await expect(service.embed('question')).rejects.toMatchObject({
      failure: {
        code: 'dimension_mismatch',
        expectedDimensions: 3,
        actualDimensions: 2,
      },
    })
  })

  it('does not call the adapter when no corpus is active', async () => {
    let calls = 0
    const adapter: IEmbeddingAdapter = {
      embed: () => {
        calls += 1
        return Promise.reject(new Error('unexpected provider call'))
      },
    }
    const service = new KnowledgeQueryEmbeddingService(
      { getActiveCorpus: () => Promise.resolve(null) },
      adapter,
    )

    await expect(service.embed('question')).rejects.toThrow(
      'No active embedding corpus is available for query embedding.',
    )
    expect(calls).toBe(0)
  })

  it('uses the canonical typed adapter error for malformed query output', async () => {
    const service = new KnowledgeQueryEmbeddingService(
      { getActiveCorpus: () => Promise.resolve(activeCorpus) },
      new StubEmbeddingAdapter({
        vectors: [],
        metadata: { profile: activeCorpus.profile, inputCount: 1, batchCount: 1 },
      }),
    )

    await expect(service.embed('question')).rejects.toBeInstanceOf(EmbeddingAdapterError)
  })
})

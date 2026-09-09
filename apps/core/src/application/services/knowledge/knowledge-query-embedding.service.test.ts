import { describe, expect, it } from 'vitest'
import {
  EmbeddingAdapterError,
  type EmbeddingBatchRequest,
  type EmbeddingBatchResult,
  type EmbeddingProfile,
  type IEmbeddingAdapter,
} from '../../../application/ports/IEmbeddingAdapter.js'
import type {
  IObservabilityAdapter,
  TraceEvent,
} from '../../../application/ports/IObservabilityAdapter.js'
import type { ActiveCorpus } from '../../../application/ports/IKnowledgeCorpusRepository.js'
import type { RetrievalQueryVariant } from '../../../domain/knowledge/knowledge.types.js'
import {
  DETERMINISTIC_HASH_EMBEDDING_PROFILE,
  HashEmbeddingAdapter,
} from '../../../infrastructure/knowledge/test-support/hash-embedding.adapter.js'
import {
  KnowledgeQueryEmbeddingService,
  type RetrievalQueryEmbeddingResult,
} from './knowledge-query-embedding.service.js'

/* eslint-disable max-lines-per-function */

const activeCorpus: ActiveCorpus = {
  corpusGenerationId: 'corpus_generation_active',
  embeddingProfileId: 'embedding_profile_active',
  profile: DETERMINISTIC_HASH_EMBEDDING_PROFILE,
}

class RecordingAdapter implements IEmbeddingAdapter {
  readonly requests: string[][] = []

  constructor(private readonly delegate: IEmbeddingAdapter) {}

  embed(request: EmbeddingBatchRequest): Promise<EmbeddingBatchResult> {
    this.requests.push([...request.inputs])
    return this.delegate.embed(request)
  }
}

class StubEmbeddingAdapter implements IEmbeddingAdapter {
  constructor(private readonly response: EmbeddingBatchResult | Error) {}

  embed(): Promise<EmbeddingBatchResult> {
    return this.response instanceof Error
      ? Promise.reject(this.response)
      : Promise.resolve(this.response)
  }
}

class RecordingObservability implements IObservabilityAdapter {
  readonly events: TraceEvent[] = []

  trace(event: TraceEvent): Promise<void> {
    this.events.push(event)
    return Promise.resolve()
  }

  flush(): Promise<void> {
    return Promise.resolve()
  }
}

function makeService(
  adapter: IEmbeddingAdapter,
  observability = new RecordingObservability(),
  corpus: ActiveCorpus | null = activeCorpus,
): KnowledgeQueryEmbeddingService {
  return new KnowledgeQueryEmbeddingService(
    { getActiveCorpus: () => Promise.resolve(corpus) },
    adapter,
    observability,
    () => 100,
  )
}

function batchResult(
  vectors: readonly number[][],
  profile: EmbeddingProfile = activeCorpus.profile,
  inputCount = vectors.length,
): EmbeddingBatchResult {
  return {
    vectors,
    metadata: { profile, inputCount, batchCount: 1 },
  }
}

function sourcesAndTexts(result: RetrievalQueryEmbeddingResult): Array<{
  source: RetrievalQueryVariant['source']
  text: string
  queryIndex: number
}> {
  return result.queryVectors.map(({ variant, queryIndex }) => ({
    source: variant.source,
    text: variant.text,
    queryIndex,
  }))
}

describe('KnowledgeQueryEmbeddingService', () => {
  it('embeds every supported query source once in normalized order', async () => {
    const adapter = new RecordingAdapter(new HashEmbeddingAdapter(activeCorpus.profile))
    const observability = new RecordingObservability()
    const service = makeService(adapter, observability)
    const queries: RetrievalQueryVariant[] = [
      { source: 'direct_query', text: ' Direct question ' },
      { source: 'last_user_input', text: 'Last user input' },
      { source: 'gm_guideline', text: 'GM guidance' },
      { source: 'gm_retrieval_query', text: 'GM query' },
      { source: 'gm_required_fact', text: 'GM required fact' },
      { source: 'working_memory', text: 'Working memory' },
      { source: 'world_context', text: 'World context' },
    ]

    const result = await service.embedVariants({ queries })

    expect(adapter.requests).toEqual([
      [
        'Direct question',
        'Last user input',
        'GM guidance',
        'GM query',
        'GM required fact',
        'Working memory',
        'World context',
      ],
    ])
    expect(sourcesAndTexts(result)).toEqual([
      { source: 'direct_query', text: 'Direct question', queryIndex: 0 },
      { source: 'last_user_input', text: 'Last user input', queryIndex: 1 },
      { source: 'gm_guideline', text: 'GM guidance', queryIndex: 2 },
      { source: 'gm_retrieval_query', text: 'GM query', queryIndex: 3 },
      { source: 'gm_required_fact', text: 'GM required fact', queryIndex: 4 },
      { source: 'working_memory', text: 'Working memory', queryIndex: 5 },
      { source: 'world_context', text: 'World context', queryIndex: 6 },
    ])
    expect(result.queryVectors).toHaveLength(7)
    expect(result.diagnostics).toMatchObject({
      outcome: 'success',
      queryVectorCount: 7,
      embeddingProfile: {
        embeddingProfileId: activeCorpus.embeddingProfileId,
        corpusGenerationId: activeCorpus.corpusGenerationId,
        provider: activeCorpus.profile.provider,
        model: activeCorpus.profile.model,
        dimensions: activeCorpus.profile.dimensions,
      },
      timings: { totalMs: 0, queryEmbeddingMs: 0 },
    })
    expect(observability.events[0]).toMatchObject({
      event: 'retrieval.query_embedding',
      output: { outcome: 'success', queryVectorCount: 7 },
      metadata: { queryCount: 7, queryVectorCount: 7 },
    })
    expect(JSON.stringify(observability.events)).not.toContain('vectors')
  })

  it('deduplicates case-insensitive text after trimming and preserves the first source', async () => {
    const adapter = new RecordingAdapter(new HashEmbeddingAdapter(activeCorpus.profile))
    const service = makeService(adapter)

    const result = await service.embedVariants({
      queries: [
        { source: 'last_user_input', text: ' Same question ' },
        { source: 'gm_retrieval_query', text: 'same question' },
        { source: 'world_context', text: '   ' },
        { source: 'working_memory', text: 'Other context' },
      ],
    })

    expect(adapter.requests).toEqual([['Same question', 'Other context']])
    expect(sourcesAndTexts(result)).toEqual([
      { source: 'last_user_input', text: 'Same question', queryIndex: 0 },
      { source: 'working_memory', text: 'Other context', queryIndex: 1 },
    ])
  })

  it('uses direct query input and skips the adapter for empty normalized input', async () => {
    const directAdapter = new RecordingAdapter(new HashEmbeddingAdapter(activeCorpus.profile))
    const direct = await makeService(directAdapter).embedVariants({ query: ' Direct query ' })

    expect(directAdapter.requests).toEqual([['Direct query']])
    expect(sourcesAndTexts(direct)).toEqual([
      { source: 'direct_query', text: 'Direct query', queryIndex: 0 },
    ])

    const emptyAdapter = new RecordingAdapter(new HashEmbeddingAdapter(activeCorpus.profile))
    const empty = await makeService(emptyAdapter).embedVariants({
      queries: [{ source: 'working_memory', text: '   ' }],
    })

    expect(emptyAdapter.requests).toEqual([])
    expect(empty).toMatchObject({
      queryVectors: [],
      diagnostics: { outcome: 'no_results', queryVectorCount: 0 },
    })
  })

  it.each([
    {
      name: 'profile mismatch',
      response: batchResult([[1, 2, 3]], {
        provider: 'other-provider',
        model: 'other-model',
        dimensions: 3,
      }),
      failure: { code: 'incompatible_profile', retryable: true },
    },
    {
      name: 'dimension mismatch',
      response: batchResult([[1, 2]], activeCorpus.profile),
      failure: { code: 'incompatible_dimension', retryable: false },
    },
    {
      name: 'malformed count',
      response: batchResult([], activeCorpus.profile, 1),
      failure: { code: 'query_embedding_failed', retryable: false },
    },
    {
      name: 'non-finite vector',
      response: batchResult([[Number.NaN, ...new Array<number>(15).fill(0)]]),
      failure: { code: 'query_embedding_failed', retryable: false },
    },
  ] as const)(
    'returns an all-or-nothing controlled failure for $name',
    async ({ response, failure }) => {
      const observability = new RecordingObservability()
      const service = makeService(new StubEmbeddingAdapter(response), observability)

      const result = await service.embedVariants({ query: 'question' })

      expect(result.queryVectors).toEqual([])
      expect(result.diagnostics).toMatchObject({
        outcome: 'failed',
        queryVectorCount: 0,
        failure,
      })
      expect(JSON.stringify(result)).not.toContain('NaN')
      expect(JSON.stringify(observability.events)).not.toContain('NaN')
    },
  )

  it('maps provider failures without retaining provider details in diagnostics', async () => {
    const observability = new RecordingObservability()
    const service = makeService(
      new StubEmbeddingAdapter(
        new EmbeddingAdapterError({
          code: 'provider_rejected',
          message: 'secret provider payload must not escape',
          retryable: false,
        }),
      ),
      observability,
    )

    const result = await service.embedVariants({ query: 'question' })

    expect(result.diagnostics.failure).toEqual({
      code: 'query_embedding_failed',
      retryable: false,
    })
    expect(JSON.stringify(result)).not.toContain('secret provider payload')
    expect(JSON.stringify(observability.events)).not.toContain('secret provider payload')
  })

  it('does not call the adapter when no active corpus exists', async () => {
    let calls = 0
    const adapter: IEmbeddingAdapter = {
      embed: () => {
        calls += 1
        return Promise.reject(new Error('unexpected provider call'))
      },
    }

    const result = await makeService(adapter, new RecordingObservability(), null).embedVariants({
      query: 'question',
    })

    expect(calls).toBe(0)
    expect(result.diagnostics).toMatchObject({
      outcome: 'failed',
      failure: { code: 'query_embedding_failed', retryable: true },
    })
  })
})

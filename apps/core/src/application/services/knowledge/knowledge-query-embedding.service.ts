import crypto from 'node:crypto'
import {
  EmbeddingAdapterError,
  isEmbeddingAdapterError,
  type EmbeddingBatchResult,
  type EmbeddingProfile,
  type IEmbeddingAdapter,
} from '../../ports/IEmbeddingAdapter.js'
import type { IKnowledgeCorpusRepository } from '../../ports/IKnowledgeCorpusRepository.js'
import type { IObservabilityAdapter, TraceEvent } from '../../ports/IObservabilityAdapter.js'
import type {
  EmbeddingVector,
  RetrievalEmbeddingProfile,
  RetrievalFailure,
  RetrievalOutcomeCode,
  RetrievalQueryVariant,
  RetrievalTimings,
} from '../../../domain/knowledge/knowledge.types.js'
import { normalizeTypedRetrievalQueries } from './typed-retrieval-query-builder.js'

export type ProfiledQueryVector = Readonly<{
  vector: EmbeddingVector
  embeddingProfileId: string
  corpusGenerationId: string
  profile: EmbeddingProfile
}>

export type RetrievalQueryEmbeddingInput = Readonly<{
  query?: string | null
  queries?: readonly RetrievalQueryVariant[]
}>

/** Internal query vector. It must never cross an API, event, log, or error boundary. */
export type RetrievalQueryVector = Readonly<{
  vector: EmbeddingVector
  variant: RetrievalQueryVariant
  queryIndex: number
}>

export type RetrievalQueryEmbeddingDiagnostics = Readonly<{
  outcome: RetrievalOutcomeCode
  queryVectorCount: number
  embeddingProfile?: RetrievalEmbeddingProfile
  timings: RetrievalTimings
  failure?: RetrievalFailure
}>

export type RetrievalQueryEmbeddingResult = Readonly<{
  queries: readonly RetrievalQueryVariant[]
  queryVectors: readonly RetrievalQueryVector[]
  diagnostics: RetrievalQueryEmbeddingDiagnostics
}>

export class RetrievalQueryEmbeddingError extends Error {
  readonly failure: RetrievalFailure

  constructor(failure: RetrievalFailure) {
    super(`Retrieval query embedding failed: ${failure.code}.`)
    this.name = 'RetrievalQueryEmbeddingError'
    this.failure = failure
  }
}

export class KnowledgeQueryEmbeddingService {
  constructor(
    private readonly corpusRepository: Pick<IKnowledgeCorpusRepository, 'getActiveCorpus'>,
    private readonly embeddingAdapter: IEmbeddingAdapter,
    private readonly observability: IObservabilityAdapter,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /**
   * Normalizes and embeds all retrieval variants through one validated batch boundary.
   * The result is all-or-nothing: an invalid batch returns zero query vectors.
   */
  async embedVariants(input: RetrievalQueryEmbeddingInput): Promise<RetrievalQueryEmbeddingResult> {
    const startedAt = this.now()
    const queries = withQueryIndexes(normalizeInput(input))
    if (queries.length === 0) {
      const timings = embeddingTimings(this.now() - startedAt)
      const result = createResult(queries, [], {
        outcome: 'no_results',
        queryVectorCount: 0,
        timings,
      })
      await this.trace(queries, result.diagnostics)
      return result
    }

    let activeCorpus: Awaited<ReturnType<IKnowledgeCorpusRepository['getActiveCorpus']>> = null
    try {
      activeCorpus = await this.corpusRepository.getActiveCorpus()
      if (activeCorpus === null) {
        return await this.failedResult(queries, startedAt, activeCorpus, {
          code: 'query_embedding_failed',
          retryable: true,
        })
      }

      const embeddingResult = await this.embeddingAdapter.embed({
        inputs: queries.map((query) => query.text),
      })
      const vectors = validateEmbeddingBatchResult(
        embeddingResult,
        activeCorpus.profile,
        queries.length,
      )
      const queryVectors = vectors.map((vector, queryIndex) => ({
        vector: Object.freeze([...vector]),
        variant: queries[queryIndex] as RetrievalQueryVariant,
        queryIndex,
      }))
      const timings = embeddingTimings(this.now() - startedAt)
      const result = createResult(queries, queryVectors, {
        outcome: 'success',
        queryVectorCount: queryVectors.length,
        embeddingProfile: toRetrievalEmbeddingProfile(activeCorpus),
        timings,
      })
      await this.trace(queries, result.diagnostics)
      return result
    } catch (error) {
      return await this.failedResult(queries, startedAt, activeCorpus, toRetrievalFailure(error))
    }
  }

  /** Compatibility wrapper for callers that still embed one direct query. */
  async embed(query: string): Promise<ProfiledQueryVector> {
    const result = await this.embedVariants({ query })
    const queryVector = result.queryVectors[0]
    if (queryVector === undefined) {
      if (result.diagnostics.failure !== undefined) {
        throw new RetrievalQueryEmbeddingError(result.diagnostics.failure)
      }
      throw new Error('No non-empty retrieval query was provided.')
    }
    const profile = result.diagnostics.embeddingProfile
    if (profile === undefined || profile.embeddingProfileId === undefined) {
      throw new Error('Query embedding did not return an active embedding profile.')
    }
    const corpusGenerationId = profile.corpusGenerationId
    if (corpusGenerationId === undefined) {
      throw new Error('Query embedding did not return a corpus generation identity.')
    }
    return {
      vector: queryVector.vector,
      embeddingProfileId: profile.embeddingProfileId,
      corpusGenerationId,
      profile: {
        provider: profile.provider,
        model: profile.model,
        dimensions: profile.dimensions,
      },
    }
  }

  private async failedResult(
    queries: readonly RetrievalQueryVariant[],
    startedAt: number,
    activeCorpus: Awaited<ReturnType<IKnowledgeCorpusRepository['getActiveCorpus']>>,
    failure: RetrievalFailure,
  ): Promise<RetrievalQueryEmbeddingResult> {
    const timings = embeddingTimings(this.now() - startedAt)
    const diagnostics: RetrievalQueryEmbeddingDiagnostics = {
      outcome: 'failed',
      queryVectorCount: 0,
      ...(activeCorpus === null
        ? {}
        : { embeddingProfile: toRetrievalEmbeddingProfile(activeCorpus) }),
      timings,
      failure,
    }
    const result = createResult(queries, [], diagnostics)
    await this.trace(queries, result.diagnostics)
    return result
  }

  private async trace(
    queries: readonly RetrievalQueryVariant[],
    diagnostics: RetrievalQueryEmbeddingDiagnostics,
  ): Promise<void> {
    const profile = diagnostics.embeddingProfile
    const event: TraceEvent = {
      requestId: crypto.randomUUID(),
      event:
        diagnostics.outcome === 'failed'
          ? 'retrieval.query_embedding.error'
          : 'retrieval.query_embedding',
      input: {
        queries: queries.map((query, queryIndex) => ({
          source: query.source,
          queryIndex,
          textLength: query.text.length,
        })),
      },
      output: {
        outcome: diagnostics.outcome,
        queryVectorCount: diagnostics.queryVectorCount,
      },
      ...(diagnostics.timings.queryEmbeddingMs === undefined
        ? {}
        : { latencyMs: diagnostics.timings.queryEmbeddingMs }),
      metadata: {
        outcome: diagnostics.outcome,
        queryCount: queries.length,
        queryVectorCount: diagnostics.queryVectorCount,
        ...(profile === undefined
          ? {}
          : {
              embeddingProfileId: profile.embeddingProfileId,
              corpusGenerationId: profile.corpusGenerationId,
              provider: profile.provider,
              model: profile.model,
              dimensions: profile.dimensions,
            }),
        ...(diagnostics.failure === undefined ? {} : { failureCode: diagnostics.failure.code }),
      },
    }
    try {
      await this.observability.trace(event)
    } catch {
      console.error('[knowledge-query-embedding] Observability trace failed.')
    }
  }
}

function normalizeInput(input: RetrievalQueryEmbeddingInput): RetrievalQueryVariant[] {
  const configuredQueries = normalizeTypedRetrievalQueries(input.queries ?? [])
  if (configuredQueries.length > 0) return configuredQueries
  if (input.query === undefined || input.query === null) return []
  return normalizeTypedRetrievalQueries([{ source: 'direct_query', text: input.query }])
}

function withQueryIndexes(queries: readonly RetrievalQueryVariant[]): RetrievalQueryVariant[] {
  return queries.map((query, queryIndex) => ({ ...query, queryIndex }))
}

function createResult(
  queries: readonly RetrievalQueryVariant[],
  queryVectors: readonly RetrievalQueryVector[],
  diagnostics: RetrievalQueryEmbeddingDiagnostics,
): RetrievalQueryEmbeddingResult {
  return Object.freeze({
    queries: Object.freeze([...queries]),
    queryVectors: Object.freeze([...queryVectors]),
    diagnostics: Object.freeze(diagnostics),
  })
}

function embeddingTimings(totalMs: number): RetrievalTimings {
  const boundedTotalMs = Math.max(0, totalMs)
  return { totalMs: boundedTotalMs, queryEmbeddingMs: boundedTotalMs }
}

function toRetrievalEmbeddingProfile(
  activeCorpus: NonNullable<Awaited<ReturnType<IKnowledgeCorpusRepository['getActiveCorpus']>>>,
): RetrievalEmbeddingProfile {
  return {
    embeddingProfileId: activeCorpus.embeddingProfileId,
    corpusGenerationId: activeCorpus.corpusGenerationId,
    provider: activeCorpus.profile.provider,
    model: activeCorpus.profile.model,
    dimensions: activeCorpus.profile.dimensions,
  }
}

function validateEmbeddingBatchResult(
  result: EmbeddingBatchResult,
  expectedProfile: EmbeddingProfile,
  expectedCount: number,
): readonly EmbeddingVector[] {
  const candidate: unknown = result
  if (!isRecord(candidate) || !Array.isArray(candidate['vectors'])) {
    throwMalformedEmbeddingResult('Embedding result did not contain a vector array.')
  }
  const vectors = candidate['vectors'] as unknown[]
  if (vectors.length !== expectedCount) {
    throw new EmbeddingAdapterError({
      code: 'malformed_response',
      message: 'Embedding result vector count did not match the normalized query count.',
      retryable: false,
      expectedCount,
      actualCount: vectors.length,
    })
  }

  const metadata = candidate['metadata']
  if (!isRecord(metadata) || !isEmbeddingProfile(metadata['profile'])) {
    throwMalformedEmbeddingResult('Embedding result did not contain a valid effective profile.')
  }
  const profile = metadata['profile']
  if (metadata['inputCount'] !== expectedCount) {
    throwMalformedEmbeddingResult('Embedding result input count did not match the query count.')
  }
  if (!sameProfile(profile, expectedProfile)) {
    throw new EmbeddingAdapterError({
      code: 'profile_mismatch',
      message: 'Query embedding profile no longer matches the active corpus.',
      retryable: true,
      expectedProfile,
      actualProfile: profile,
    })
  }

  return vectors.map((vector, index) => {
    if (!Array.isArray(vector)) {
      throwMalformedEmbeddingResult(`Embedding vector ${String(index)} is not an array.`)
    }
    if (vector.length !== expectedProfile.dimensions) {
      throw new EmbeddingAdapterError({
        code: 'dimension_mismatch',
        message: 'Query embedding dimension does not match the active profile.',
        retryable: false,
        expectedDimensions: expectedProfile.dimensions,
        actualDimensions: vector.length,
        inputIndex: index,
      })
    }
    if (
      !vector.every((value): value is number => typeof value === 'number' && Number.isFinite(value))
    ) {
      throwMalformedEmbeddingResult(
        `Embedding vector ${String(index)} contained a non-finite value.`,
      )
    }
    return Object.freeze([...vector])
  })
}

function toRetrievalFailure(error: unknown): RetrievalFailure {
  if (!isEmbeddingAdapterError(error)) {
    return { code: 'query_embedding_failed', retryable: false }
  }
  switch (error.failure.code) {
    case 'profile_mismatch':
      return { code: 'incompatible_profile', retryable: error.failure.retryable }
    case 'dimension_mismatch':
      return { code: 'incompatible_dimension', retryable: false }
    default:
      return { code: 'query_embedding_failed', retryable: error.failure.retryable }
  }
}

function throwMalformedEmbeddingResult(message: string): never {
  throw new EmbeddingAdapterError({ code: 'malformed_response', message, retryable: false })
}

function isEmbeddingProfile(value: unknown): value is EmbeddingProfile {
  if (!isRecord(value)) return false
  return (
    typeof value['provider'] === 'string' &&
    typeof value['model'] === 'string' &&
    typeof value['dimensions'] === 'number' &&
    Number.isInteger(value['dimensions']) &&
    value['dimensions'] > 0
  )
}

function sameProfile(left: EmbeddingProfile, right: EmbeddingProfile): boolean {
  return (
    left.provider === right.provider &&
    left.model === right.model &&
    left.dimensions === right.dimensions
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

import {
  EmbeddingAdapterError,
  type EmbeddingProfile,
  type IEmbeddingAdapter,
} from '../../ports/IEmbeddingAdapter.js'
import type { IKnowledgeCorpusRepository } from '../../ports/IKnowledgeCorpusRepository.js'
import type { EmbeddingVector } from '../../../domain/knowledge/knowledge.types.js'

export type ProfiledQueryVector = Readonly<{
  vector: EmbeddingVector
  embeddingProfileId: string
  corpusGenerationId: string
  profile: EmbeddingProfile
}>

export class KnowledgeQueryEmbeddingService {
  constructor(
    private readonly corpusRepository: Pick<IKnowledgeCorpusRepository, 'getActiveCorpus'>,
    private readonly embeddingAdapter: IEmbeddingAdapter,
  ) {}

  async embed(query: string): Promise<ProfiledQueryVector> {
    const activeCorpus = await this.corpusRepository.getActiveCorpus()
    if (activeCorpus === null) {
      throw new Error('No active embedding corpus is available for query embedding.')
    }

    const result = await this.embeddingAdapter.embed({ inputs: [query] })
    const vector = result.vectors[0]
    if (result.vectors.length !== 1 || vector === undefined) {
      throw new EmbeddingAdapterError({
        code: 'malformed_response',
        message: 'Query embedding did not return exactly one vector.',
        retryable: false,
        expectedCount: 1,
        actualCount: result.vectors.length,
      })
    }

    if (!sameProfile(result.metadata.profile, activeCorpus.profile)) {
      throw new EmbeddingAdapterError({
        code: 'profile_mismatch',
        message: 'Query embedding profile no longer matches the active corpus.',
        retryable: true,
        expectedProfile: activeCorpus.profile,
        actualProfile: result.metadata.profile,
      })
    }
    validateVector(vector, activeCorpus.profile)

    return Object.freeze({
      vector: Object.freeze([...vector]),
      embeddingProfileId: activeCorpus.embeddingProfileId,
      corpusGenerationId: activeCorpus.corpusGenerationId,
      profile: activeCorpus.profile,
    })
  }
}

function sameProfile(left: EmbeddingProfile, right: EmbeddingProfile): boolean {
  return (
    left.provider === right.provider &&
    left.model === right.model &&
    left.dimensions === right.dimensions
  )
}

function validateVector(vector: EmbeddingVector, profile: EmbeddingProfile): void {
  if (vector.length !== profile.dimensions) {
    throw new EmbeddingAdapterError({
      code: 'dimension_mismatch',
      message: 'Query embedding dimension does not match the active profile.',
      retryable: false,
      expectedDimensions: profile.dimensions,
      actualDimensions: vector.length,
    })
  }
  if (!vector.every((value) => Number.isFinite(value))) {
    throw new EmbeddingAdapterError({
      code: 'malformed_response',
      message: 'Query embedding contained a non-finite value.',
      retryable: false,
    })
  }
}

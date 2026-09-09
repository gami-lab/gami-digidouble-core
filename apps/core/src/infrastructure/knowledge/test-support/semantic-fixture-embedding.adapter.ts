import {
  EmbeddingAdapterError,
  type EmbeddingBatchRequest,
  type EmbeddingBatchResult,
  type EmbeddingProfile,
  type IEmbeddingAdapter,
} from '../../../application/ports/IEmbeddingAdapter.js'

/**
 * Test-only adapter whose exact input fixtures point at predeclared semantic vectors.
 * It deliberately has no tokenization or text-similarity behavior.
 */
export class SemanticFixtureEmbeddingAdapter implements IEmbeddingAdapter {
  private readonly profile: EmbeddingProfile
  private readonly fixtures: ReadonlyMap<string, readonly number[]>

  constructor(profile: EmbeddingProfile, fixtures: ReadonlyMap<string, readonly number[]>) {
    this.profile = Object.freeze({ ...profile })
    this.fixtures = new Map(
      [...fixtures].map(([input, vector]) => [input, Object.freeze([...vector])]),
    )
  }

  embed(request: EmbeddingBatchRequest): Promise<EmbeddingBatchResult> {
    if (request.inputs.length === 0) {
      return Promise.reject(
        new EmbeddingAdapterError({
          code: 'invalid_input',
          reason: 'empty_batch',
          message: 'Semantic fixture batch must contain at least one input.',
          retryable: false,
        }),
      )
    }

    const vectors = request.inputs.map((input, inputIndex) => {
      const vector = this.fixtures.get(input)
      if (vector === undefined) {
        throw new EmbeddingAdapterError({
          code: 'malformed_response',
          message: 'Semantic fixture input was not configured.',
          retryable: false,
        })
      }
      if (
        vector.length !== this.profile.dimensions ||
        vector.some((value) => !Number.isFinite(value))
      ) {
        throw new EmbeddingAdapterError({
          code: 'dimension_mismatch',
          message: 'Semantic fixture vector does not match its profile.',
          retryable: false,
          expectedDimensions: this.profile.dimensions,
          actualDimensions: vector.length,
          inputIndex,
        })
      }
      return Object.freeze([...vector])
    })

    return Promise.resolve({
      vectors: Object.freeze(vectors),
      metadata: Object.freeze({
        profile: this.profile,
        inputCount: request.inputs.length,
        batchCount: 1,
      }),
    })
  }
}

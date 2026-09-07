import {
  EmbeddingAdapterError,
  type EmbeddingBatchRequest,
  type EmbeddingBatchResult,
  type EmbeddingProfile,
  type IEmbeddingAdapter,
} from '../../../application/ports/IEmbeddingAdapter.js'

export const DETERMINISTIC_HASH_EMBEDDING_PROFILE: EmbeddingProfile = Object.freeze({
  provider: 'test-hash',
  model: 'character-buckets-v1',
  dimensions: 16,
})

export class HashEmbeddingAdapter implements IEmbeddingAdapter {
  private readonly profile: EmbeddingProfile

  constructor(profile: EmbeddingProfile) {
    if (!Number.isInteger(profile.dimensions) || profile.dimensions <= 0) {
      throw new EmbeddingAdapterError({
        code: 'dimension_mismatch',
        message: 'Deterministic hash profile dimensions must be a positive integer.',
        retryable: false,
        expectedDimensions: 1,
        actualDimensions: profile.dimensions,
      })
    }

    this.profile = Object.freeze({ ...profile })
  }

  embed(request: EmbeddingBatchRequest): Promise<EmbeddingBatchResult> {
    if (request.inputs.length === 0) {
      return Promise.reject(
        new EmbeddingAdapterError({
          code: 'invalid_input',
          reason: 'empty_batch',
          message: 'Embedding batch must contain at least one input.',
          retryable: false,
        }),
      )
    }

    for (const [index, input] of request.inputs.entries()) {
      if (typeof input !== 'string') {
        return Promise.reject(
          new EmbeddingAdapterError({
            code: 'invalid_input',
            reason: 'non_string_input',
            message: `Embedding input at index ${String(index)} must be a string.`,
            retryable: false,
            inputIndex: index,
          }),
        )
      }
      if (input.trim().length === 0) {
        return Promise.reject(
          new EmbeddingAdapterError({
            code: 'invalid_input',
            reason: 'blank_input',
            message: `Embedding input at index ${String(index)} must not be blank.`,
            retryable: false,
            inputIndex: index,
          }),
        )
      }
    }

    const vectors = request.inputs.map((input) =>
      Object.freeze(toVector(input, this.profile.dimensions)),
    )
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

function toVector(input: string, dimensions: number): number[] {
  const values = new Array<number>(dimensions).fill(0)
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i)
    const index = i % dimensions
    values[index] = (values[index] ?? 0) + code
  }

  const norm = Math.sqrt(values.reduce((acc, value) => acc + value * value, 0)) || 1
  return values.map((value) => Number((value / norm).toFixed(6)))
}

import {
  EmbeddingAdapterError,
  type EmbeddingBatchRequest,
  type EmbeddingBatchResult,
  type IEmbeddingAdapter,
} from '../../application/ports/IEmbeddingAdapter.js'

/**
 * Keeps the production composition explicit until a real provider adapter is
 * installed. It prevents accidental hash-vector generation in production.
 */
export class UnconfiguredEmbeddingAdapter implements IEmbeddingAdapter {
  embed(_request: EmbeddingBatchRequest): Promise<EmbeddingBatchResult> {
    return Promise.reject(
      new EmbeddingAdapterError({
        code: 'provider_rejected',
        message: 'No production embedding provider is configured.',
        retryable: false,
      }),
    )
  }
}

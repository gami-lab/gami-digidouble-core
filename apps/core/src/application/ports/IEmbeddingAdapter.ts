import type { EmbeddingVector } from '../../domain/knowledge/knowledge.types.js'

export type { EmbeddingVector }

/**
 * The provider-neutral identity of one embedding space.
 *
 * This is application-owned. Provider SDK response types and configuration
 * parsing stay in Infrastructure.
 */
export type EmbeddingProfile = Readonly<{
  provider: string
  model: string
  dimensions: number
}>

/** Inputs are embedded in this order; result vectors use the same order. */
export type EmbeddingBatchRequest = Readonly<{
  inputs: readonly string[]
}>

/** Usage fields are intentionally provider-neutral and optional. */
export type EmbeddingUsage = Readonly<{
  inputTokens?: number
}>

export type EmbeddingBatchMetadata = Readonly<{
  profile: EmbeddingProfile
  inputCount: number
  batchCount: number
  usage?: EmbeddingUsage
  latencyMs?: number
}>

export type EmbeddingBatchResult = Readonly<{
  /** Vector at index N corresponds to request.inputs[N]. */
  vectors: readonly EmbeddingVector[]
  metadata: EmbeddingBatchMetadata
}>

export type EmbeddingFailure =
  | Readonly<{
      code: 'invalid_input'
      reason: 'empty_batch' | 'blank_input' | 'non_string_input'
      message: string
      retryable: false
      inputIndex?: number
    }>
  | Readonly<{
      code: 'provider_rejected'
      message: string
      retryable: false
    }>
  | Readonly<{
      code: 'rate_limited'
      message: string
      retryable: true
    }>
  | Readonly<{
      code: 'malformed_response'
      message: string
      retryable: false
      expectedCount?: number
      actualCount?: number
    }>
  | Readonly<{
      code: 'dimension_mismatch'
      message: string
      retryable: false
      expectedDimensions: number
      actualDimensions: number
      inputIndex?: number
    }>
  | Readonly<{
      code: 'profile_mismatch'
      message: string
      retryable: true
      expectedProfile: EmbeddingProfile
      actualProfile: EmbeddingProfile
    }>

/** Typed application failure for an embedding batch. */
export class EmbeddingAdapterError extends Error {
  readonly failure: EmbeddingFailure

  constructor(failure: EmbeddingFailure) {
    super(failure.message)
    this.name = 'EmbeddingAdapterError'
    this.failure = failure
  }
}

export function isEmbeddingAdapterError(error: unknown): error is EmbeddingAdapterError {
  return error instanceof EmbeddingAdapterError
}

export interface IEmbeddingAdapter {
  embed(request: EmbeddingBatchRequest): Promise<EmbeddingBatchResult>
}

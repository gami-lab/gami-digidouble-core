import { describe, expect, it } from 'vitest'
import {
  EmbeddingAdapterError,
  isEmbeddingAdapterError,
  type EmbeddingFailure,
} from '../../../application/ports/IEmbeddingAdapter.js'
import {
  DETERMINISTIC_HASH_EMBEDDING_PROFILE,
  HashEmbeddingAdapter,
} from './hash-embedding.adapter.js'

describe('HashEmbeddingAdapter test support', () => {
  it('preserves input order and reports deterministic effective metadata', async () => {
    const adapter = new HashEmbeddingAdapter(DETERMINISTIC_HASH_EMBEDDING_PROFILE)

    const result = await adapter.embed({ inputs: ['alpha', 'beta'] })

    expect(result.vectors).toHaveLength(2)
    expect(result.vectors[0]).not.toEqual(result.vectors[1])
    expect(result.metadata).toEqual({
      profile: DETERMINISTIC_HASH_EMBEDDING_PROFILE,
      inputCount: 2,
    })
    expect(result.vectors.every((vector) => vector.length === 16)).toBe(true)
  })

  it('returns copy-safe frozen vectors for each batch result', async () => {
    const adapter = new HashEmbeddingAdapter(DETERMINISTIC_HASH_EMBEDDING_PROFILE)

    const first = await adapter.embed({ inputs: ['same input'] })
    const second = await adapter.embed({ inputs: ['same input'] })

    expect(Object.isFrozen(first.vectors)).toBe(true)
    expect(Object.isFrozen(first.vectors[0])).toBe(true)
    expect(first.vectors).not.toBe(second.vectors)
    expect(first.vectors[0]).not.toBe(second.vectors[0])
    expect(first.vectors).toEqual(second.vectors)
  })

  it.each([
    ['empty_batch', []],
    ['blank_input', ['   ']],
  ] as const)('rejects %s with a typed non-retryable failure', async (reason, inputs) => {
    const adapter = new HashEmbeddingAdapter(DETERMINISTIC_HASH_EMBEDDING_PROFILE)

    const error = await adapter.embed({ inputs }).catch((candidate: unknown) => candidate)

    expect(error).toBeInstanceOf(EmbeddingAdapterError)
    expect((error as EmbeddingAdapterError).failure).toMatchObject<Partial<EmbeddingFailure>>({
      code: 'invalid_input',
      reason,
      retryable: false,
    })
  })

  it('keeps provider-neutral retry and diagnostics categories finite', () => {
    const failures: EmbeddingFailure[] = [
      {
        code: 'provider_rejected',
        message: 'rejected',
        retryable: false,
      },
      {
        code: 'rate_limited',
        message: 'slow down',
        retryable: true,
      },
      {
        code: 'malformed_response',
        message: 'count mismatch',
        retryable: false,
        expectedCount: 2,
        actualCount: 1,
      },
      {
        code: 'dimension_mismatch',
        message: 'wrong dimension',
        retryable: false,
        expectedDimensions: 16,
        actualDimensions: 8,
      },
    ]

    const errors = failures.map((failure) => new EmbeddingAdapterError(failure))

    expect(errors.every((error) => isEmbeddingAdapterError(error))).toBe(true)
    expect(errors.map((error) => error.failure.code)).toEqual([
      'provider_rejected',
      'rate_limited',
      'malformed_response',
      'dimension_mismatch',
    ])
    expect(errors.map((error) => error.failure.retryable)).toEqual([false, true, false, false])
  })
})

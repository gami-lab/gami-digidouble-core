import { describe, expect, it } from 'vitest'
import { isEmbeddingAdapterError } from '../../application/ports/IEmbeddingAdapter.js'
import { NullObservabilityAdapter } from '../observability/null.adapter.js'
import {
  DEFAULT_OPENAI_EMBEDDING_DIMENSIONS,
  DEFAULT_OPENAI_EMBEDDING_MODEL,
  OpenAiEmbeddingAdapter,
} from './openai-embedding.adapter.js'

const apiKey = process.env['OPENAI_API_KEY']

describe.skipIf(!apiKey)('OpenAiEmbeddingAdapter — live integration', () => {
  it('returns a configured finite vector from the live API', async (context) => {
    if (apiKey === undefined) {
      context.skip('OPENAI_API_KEY is not configured')
      return
    }

    const adapter = new OpenAiEmbeddingAdapter(
      {
        provider: 'openai',
        model: DEFAULT_OPENAI_EMBEDDING_MODEL,
        dimensions: DEFAULT_OPENAI_EMBEDDING_DIMENSIONS,
        maxBatchSize: 100,
        openaiApiKey: apiKey,
      },
      new NullObservabilityAdapter(),
    )

    try {
      const response = await adapter.embed({ inputs: ['A short provider smoke test.'] })
      expect(response.vectors).toHaveLength(1)
      expect(response.vectors[0]).toHaveLength(DEFAULT_OPENAI_EMBEDDING_DIMENSIONS)
      expect(response.vectors[0]?.every(Number.isFinite)).toBe(true)
      expect(response.metadata.profile).toEqual({
        provider: 'openai',
        model: DEFAULT_OPENAI_EMBEDDING_MODEL,
        dimensions: DEFAULT_OPENAI_EMBEDDING_DIMENSIONS,
      })
      expect(response.metadata.usage?.inputTokens).toBeGreaterThan(0)
    } catch (error) {
      if (isEmbeddingAdapterError(error) && error.failure.code === 'rate_limited') {
        context.skip(
          'SKIPPED provider=OpenAI category=quota_or_rate_limit; live provider smoke test',
        )
      }
      throw error
    }
  }, 30_000)
})

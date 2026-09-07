import type OpenAI from 'openai'
import { describe, expect, it, vi } from 'vitest'
import type { IObservabilityAdapter } from '../../application/ports/IObservabilityAdapter.js'
import { isEmbeddingAdapterError } from '../../application/ports/IEmbeddingAdapter.js'
import {
  DEFAULT_OPENAI_EMBEDDING_MODEL,
  OpenAiEmbeddingAdapter,
  createEmbeddingAdapter,
  type OpenAiEmbeddingClient,
} from './openai-embedding.adapter.js'

const profileConfig = {
  provider: 'openai',
  model: DEFAULT_OPENAI_EMBEDDING_MODEL,
  dimensions: 3,
  maxBatchSize: 2,
  openaiApiKey: 'sk-test',
}

function createObservability(): {
  adapter: IObservabilityAdapter
  trace: ReturnType<typeof vi.fn>
} {
  const trace = vi.fn().mockResolvedValue(undefined)
  return {
    trace,
    adapter: { trace, flush: vi.fn().mockResolvedValue(undefined) },
  }
}

function createClient(responses: Array<OpenAI.CreateEmbeddingResponse | Error>): {
  client: OpenAiEmbeddingClient
  create: ReturnType<
    typeof vi.fn<(body: OpenAI.EmbeddingCreateParams) => Promise<OpenAI.CreateEmbeddingResponse>>
  >
} {
  const create = vi.fn((_: OpenAI.EmbeddingCreateParams) => {
    const response = responses.shift()
    if (response instanceof Error) throw response
    if (response === undefined) throw new Error('No fake embedding response configured.')
    return Promise.resolve(response)
  })
  return { client: { embeddings: { create } }, create }
}

function createResponse(
  inputCount: number,
  options: {
    startValue?: number
    order?: number[]
    dimensions?: number
    model?: string
    usageTokens?: number
    values?: number[][]
  } = {},
): OpenAI.CreateEmbeddingResponse {
  const dimensions = options.dimensions ?? 3
  const order = options.order ?? Array.from({ length: inputCount }, (_, index) => index)
  return {
    object: 'list',
    model: options.model ?? DEFAULT_OPENAI_EMBEDDING_MODEL,
    data: order.map((index) => ({
      object: 'embedding',
      index,
      embedding:
        options.values?.[index] ??
        Array.from(
          { length: dimensions },
          (_, dimension) => (options.startValue ?? 0) + index * 10 + dimension,
        ),
    })),
    usage: {
      prompt_tokens: options.usageTokens ?? inputCount,
      total_tokens: options.usageTokens ?? inputCount,
    },
  }
}

function createAdapter(
  responses: Array<OpenAI.CreateEmbeddingResponse | Error>,
  overrides: Partial<typeof profileConfig> = {},
): {
  adapter: OpenAiEmbeddingAdapter
  create: ReturnType<typeof createClient>['create']
  trace: ReturnType<typeof vi.fn>
} {
  const observability = createObservability()
  const fake = createClient(responses)
  return {
    adapter: new OpenAiEmbeddingAdapter(
      { ...profileConfig, ...overrides },
      observability.adapter,
      fake.client,
    ),
    create: fake.create,
    trace: observability.trace,
  }
}

// eslint-disable-next-line max-lines-per-function
describe('OpenAiEmbeddingAdapter', () => {
  it('splits batches and restores provider items to global input order', async () => {
    const { adapter, create } = createAdapter([
      createResponse(2, { startValue: 100, order: [1, 0] }),
      createResponse(2, { startValue: 200, order: [1, 0] }),
      createResponse(1, { startValue: 300 }),
    ])

    const result = await adapter.embed({ inputs: ['a', 'b', 'c', 'd', 'e'] })

    expect(create).toHaveBeenCalledTimes(3)
    expect(create.mock.calls.map((call) => call[0])).toEqual([
      expect.objectContaining({ input: ['a', 'b'], dimensions: 3 }),
      expect.objectContaining({ input: ['c', 'd'], dimensions: 3 }),
      expect.objectContaining({ input: ['e'], dimensions: 3 }),
    ])
    expect(result.vectors).toEqual([
      [100, 101, 102],
      [110, 111, 112],
      [200, 201, 202],
      [210, 211, 212],
      [300, 301, 302],
    ])
    expect(result.metadata).toMatchObject({
      inputCount: 5,
      batchCount: 3,
      profile: { provider: 'openai', model: DEFAULT_OPENAI_EMBEDDING_MODEL, dimensions: 3 },
      usage: { inputTokens: 5 },
    })
  })

  it('copies and freezes vectors and records bounded success observability', async () => {
    const { adapter, trace } = createAdapter([createResponse(1, { usageTokens: 7 })])
    const result = await adapter.embed({ inputs: ['private source text'] })

    expect(Object.isFrozen(result.vectors)).toBe(true)
    expect(Object.isFrozen(result.vectors[0])).toBe(true)
    const event = trace.mock.calls[0]?.[0] as
      | {
          event: string
          input: { inputCount: number }
          inputTokens?: number
          output?: unknown
          metadata: Record<string, unknown>
        }
      | undefined
    expect(event).toMatchObject({
      event: 'embedding.batch',
      input: { inputCount: 1 },
      inputTokens: 7,
      metadata: {
        outcome: 'success',
        batchCount: 1,
        model: DEFAULT_OPENAI_EMBEDDING_MODEL,
        dimensions: 3,
      },
    })
    expect(event).not.toHaveProperty('output')
  })

  it('rejects empty and blank input before making a provider request', async () => {
    const empty = createAdapter([])
    await expect(empty.adapter.embed({ inputs: [] })).rejects.toMatchObject({
      failure: { code: 'invalid_input', reason: 'empty_batch' },
    })
    expect(empty.create).not.toHaveBeenCalled()

    const blank = createAdapter([])
    await expect(blank.adapter.embed({ inputs: ['  '] })).rejects.toMatchObject({
      failure: { code: 'invalid_input', reason: 'blank_input', inputIndex: 0 },
    })
    expect(blank.create).not.toHaveBeenCalled()

    const nonString = createAdapter([])
    await expect(
      nonString.adapter.embed({ inputs: [42] as unknown as string[] }),
    ).rejects.toMatchObject({
      failure: { code: 'invalid_input', reason: 'non_string_input', inputIndex: 0 },
    })
    expect(nonString.create).not.toHaveBeenCalled()
  })

  it('translates count, index, model, numeric, and dimension validation failures', async () => {
    const count = createAdapter([createResponse(1)])
    await expect(count.adapter.embed({ inputs: ['a', 'b'] })).rejects.toMatchObject({
      failure: { code: 'malformed_response', expectedCount: 2, actualCount: 1 },
    })

    const index = createAdapter([createResponse(2, { order: [0, 0] })])
    await expect(index.adapter.embed({ inputs: ['a', 'b'] })).rejects.toMatchObject({
      failure: { code: 'malformed_response' },
    })

    const model = createAdapter([createResponse(1, { model: 'text-embedding-3-large' })])
    await expect(model.adapter.embed({ inputs: ['a'] })).rejects.toMatchObject({
      failure: { code: 'malformed_response' },
    })

    const numeric = createAdapter([createResponse(1, { values: [[Number.NaN, 0, 1]] })])
    await expect(numeric.adapter.embed({ inputs: ['a'] })).rejects.toMatchObject({
      failure: { code: 'malformed_response' },
    })

    const dimensions = createAdapter([createResponse(1, { dimensions: 2 })])
    await expect(dimensions.adapter.embed({ inputs: ['a'] })).rejects.toMatchObject({
      failure: {
        code: 'dimension_mismatch',
        expectedDimensions: 3,
        actualDimensions: 2,
        inputIndex: 0,
      },
    })
  })

  it('translates rate limits and provider failures into retry-aware failures', async () => {
    const rateLimited = createAdapter([Object.assign(new Error('try later'), { status: 429 })])
    await expect(rateLimited.adapter.embed({ inputs: ['a'] })).rejects.toMatchObject({
      failure: { code: 'rate_limited', retryable: true },
    })

    const rejected = createAdapter([new Error('provider unavailable')])
    const error = await rejected.adapter.embed({ inputs: ['a'] }).catch((caught: unknown) => caught)
    expect(isEmbeddingAdapterError(error)).toBe(true)
    expect(error).toMatchObject({
      failure: { code: 'provider_rejected', retryable: false },
    })
  })

  it('validates model and dimensions at construction time', () => {
    expect(
      () =>
        new OpenAiEmbeddingAdapter(
          {
            ...profileConfig,
            model: 'text-embedding-3-large',
            dimensions: 3073,
          },
          createObservability().adapter,
          createClient([]).client,
        ),
    ).toThrow(/incompatible/)

    expect(
      () =>
        new OpenAiEmbeddingAdapter(
          { ...profileConfig, maxBatchSize: 2049 },
          createObservability().adapter,
          createClient([]).client,
        ),
    ).toThrow(/OpenAI limit/)
  })

  it('fails production composition for unsupported providers and missing credentials', () => {
    expect(() =>
      createEmbeddingAdapter(
        { ...profileConfig, provider: 'anthropic' },
        createObservability().adapter,
      ),
    ).toThrow('Unsupported embedding provider: anthropic')

    const withoutOpenAiKey = {
      provider: profileConfig.provider,
      model: profileConfig.model,
      dimensions: profileConfig.dimensions,
      maxBatchSize: profileConfig.maxBatchSize,
    }
    expect(() => createEmbeddingAdapter(withoutOpenAiKey, createObservability().adapter)).toThrow(
      'Missing OPENAI_API_KEY',
    )
  })
})

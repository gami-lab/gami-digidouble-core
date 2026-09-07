import crypto from 'node:crypto'
import OpenAI from 'openai'
import {
  EmbeddingAdapterError,
  isEmbeddingAdapterError,
  type EmbeddingBatchRequest,
  type EmbeddingBatchResult,
  type EmbeddingFailure,
  type EmbeddingProfile,
  type EmbeddingUsage,
  type IEmbeddingAdapter,
} from '../../application/ports/IEmbeddingAdapter.js'
import type { IObservabilityAdapter } from '../../application/ports/IObservabilityAdapter.js'
import type { EmbeddingVector } from '../../domain/knowledge/knowledge.types.js'
import {
  DEFAULT_EMBEDDING_BATCH_SIZE,
  DEFAULT_EMBEDDING_DIMENSIONS,
  DEFAULT_EMBEDDING_MODEL,
} from '../../config.js'

const REQUEST_TIMEOUT_MS = 30_000
const OPENAI_MAX_BATCH_SIZE = 2048

export const DEFAULT_OPENAI_EMBEDDING_MODEL = DEFAULT_EMBEDDING_MODEL
export const DEFAULT_OPENAI_EMBEDDING_DIMENSIONS = DEFAULT_EMBEDDING_DIMENSIONS
export const DEFAULT_OPENAI_EMBEDDING_BATCH_SIZE = DEFAULT_EMBEDDING_BATCH_SIZE

export type EmbeddingAdapterConfig = Readonly<{
  provider: string
  model: string
  dimensions: number
  maxBatchSize: number
  openaiApiKey?: string
}>

export interface OpenAiEmbeddingClient {
  embeddings: {
    create(body: OpenAI.EmbeddingCreateParams): Promise<OpenAI.CreateEmbeddingResponse>
  }
}

export function createEmbeddingAdapter(
  config: EmbeddingAdapterConfig,
  observability: IObservabilityAdapter,
): IEmbeddingAdapter {
  switch (config.provider) {
    case 'openai':
      if (config.openaiApiKey === undefined || config.openaiApiKey.trim().length === 0) {
        throw new Error('Missing OPENAI_API_KEY for the configured OpenAI embedding provider.')
      }
      return new OpenAiEmbeddingAdapter(
        { ...config, openaiApiKey: config.openaiApiKey },
        observability,
      )
    default:
      throw new Error(`Unsupported embedding provider: ${config.provider}`)
  }
}

export class OpenAiEmbeddingAdapter implements IEmbeddingAdapter {
  private readonly client: OpenAiEmbeddingClient
  private readonly profile: EmbeddingProfile
  private readonly maxBatchSize: number

  constructor(
    config: EmbeddingAdapterConfig & { openaiApiKey: string },
    private readonly observability: IObservabilityAdapter,
    client?: OpenAiEmbeddingClient,
  ) {
    validateConfig(config)
    this.profile = Object.freeze({
      provider: 'openai',
      model: config.model,
      dimensions: config.dimensions,
    })
    this.maxBatchSize = config.maxBatchSize
    this.client = client ?? new OpenAI({ apiKey: config.openaiApiKey, timeout: REQUEST_TIMEOUT_MS })
  }

  async embed(request: EmbeddingBatchRequest): Promise<EmbeddingBatchResult> {
    const startedAt = Date.now()
    let inputCount = 0
    let batchCount = 0
    let completedBatchCount = 0
    let totalInputTokens = 0
    let hasUsage = false

    try {
      const inputs = validateInputs(request)
      inputCount = inputs.length
      batchCount = Math.ceil(inputCount / this.maxBatchSize)
      const vectors: Array<EmbeddingVector | undefined> = new Array<EmbeddingVector | undefined>(
        inputCount,
      )

      for (let start = 0; start < inputs.length; start += this.maxBatchSize) {
        const batch = inputs.slice(start, start + this.maxBatchSize)
        const response = await this.createBatch(batch)
        const validated = validateResponse(response, batch.length, this.profile)

        for (const [index, vector] of validated.vectors.entries()) {
          vectors[start + index] = vector
        }
        if (validated.usage !== undefined) {
          hasUsage = true
          totalInputTokens += validated.usage.inputTokens ?? 0
        }
        completedBatchCount += 1
      }

      const result: EmbeddingBatchResult = {
        vectors: Object.freeze(vectors.map((vector) => vector as EmbeddingVector)),
        metadata: Object.freeze({
          profile: this.profile,
          inputCount,
          batchCount,
          ...(hasUsage ? { usage: { inputTokens: totalInputTokens } } : {}),
          latencyMs: Date.now() - startedAt,
        }),
      }
      this.trace({
        inputCount,
        batchCount,
        completedBatchCount,
        latencyMs: result.metadata.latencyMs ?? 0,
        ...(hasUsage ? { inputTokens: totalInputTokens } : {}),
        outcome: 'success',
      })
      return result
    } catch (error) {
      const failure = toEmbeddingFailure(error)
      this.trace({
        inputCount,
        batchCount,
        completedBatchCount,
        latencyMs: Date.now() - startedAt,
        outcome: 'failure',
        failure,
      })
      throw toEmbeddingError(error, failure)
    }
  }

  private async createBatch(inputs: readonly string[]): Promise<OpenAI.CreateEmbeddingResponse> {
    try {
      return await this.client.embeddings.create({
        model: this.profile.model,
        input: [...inputs],
        ...(supportsDimensions(this.profile.model) ? { dimensions: this.profile.dimensions } : {}),
        encoding_format: 'float',
      })
    } catch (error) {
      throw translateProviderError(error)
    }
  }

  private trace(args: {
    inputCount: number
    batchCount: number
    completedBatchCount: number
    latencyMs: number
    inputTokens?: number
    outcome: 'success' | 'failure'
    failure?: EmbeddingFailure
  }): void {
    const failure = args.failure
    void this.observability
      .trace({
        requestId: crypto.randomUUID(),
        event: failure === undefined ? 'embedding.batch' : 'embedding.batch.error',
        input: { inputCount: args.inputCount },
        ...(failure === undefined ? {} : { output: { code: failure.code } }),
        latencyMs: args.latencyMs,
        ...(args.inputTokens === undefined ? {} : { inputTokens: args.inputTokens }),
        metadata: {
          provider: this.profile.provider,
          model: this.profile.model,
          dimensions: this.profile.dimensions,
          batchCount: args.batchCount,
          completedBatchCount: args.completedBatchCount,
          outcome: args.outcome,
          ...(failure === undefined ? {} : { failureCode: failure.code }),
        },
      })
      .catch((error: unknown) => {
        console.error('[openai-embedding] Observability trace failed:', error)
      })
  }
}

function validateConfig(config: EmbeddingAdapterConfig): void {
  validateProvider(config)
  validateCredentials(config)
  validateModelAndDimensions(config)
  validateBatchSize(config)
}

function validateProvider(config: EmbeddingAdapterConfig): void {
  if (config.provider !== 'openai') {
    throw new Error(`OpenAI embedding adapter cannot use provider: ${config.provider}`)
  }
}

function validateCredentials(config: EmbeddingAdapterConfig): void {
  if (config.openaiApiKey === undefined || config.openaiApiKey.trim().length === 0) {
    throw new Error('Missing OPENAI_API_KEY for the configured OpenAI embedding provider.')
  }
}

function validateModelAndDimensions(config: EmbeddingAdapterConfig): void {
  if (!supportedModel(config.model)) {
    throw new Error(`Unsupported OpenAI embedding model: ${config.model}`)
  }
  if (!Number.isInteger(config.dimensions) || config.dimensions <= 0) {
    throw new Error('Embedding dimensions must be a positive integer.')
  }
  const maxDimensions = maxDimensionsForModel(config.model)
  if (config.model === 'text-embedding-ada-002' && config.dimensions !== 1536) {
    throw new Error(
      `Embedding dimensions ${String(config.dimensions)} are incompatible with ${config.model}; expected 1536.`,
    )
  }
  if (supportsDimensions(config.model) && config.dimensions > maxDimensions) {
    throw new Error(
      `Embedding dimensions ${String(config.dimensions)} are incompatible with ${config.model}; expected at most ${String(maxDimensions)}.`,
    )
  }
}

function validateBatchSize(config: EmbeddingAdapterConfig): void {
  if (!Number.isInteger(config.maxBatchSize) || config.maxBatchSize < 1) {
    throw new Error('Embedding batch size must be a positive integer.')
  }
  if (config.maxBatchSize > OPENAI_MAX_BATCH_SIZE) {
    throw new Error(
      `Embedding batch size cannot exceed the OpenAI limit of ${String(OPENAI_MAX_BATCH_SIZE)} inputs.`,
    )
  }
}

function validateInputs(request: EmbeddingBatchRequest): readonly string[] {
  const candidate: unknown = request.inputs
  if (!Array.isArray(candidate) || candidate.length === 0) {
    throw newEmbeddingError({
      code: 'invalid_input',
      reason: 'empty_batch',
      message: 'Embedding batch must contain at least one input.',
      retryable: false,
    })
  }
  const inputs = candidate as readonly unknown[]
  const validated: string[] = []
  for (const [index, input] of inputs.entries()) {
    if (typeof input !== 'string') {
      throw newEmbeddingError({
        code: 'invalid_input',
        reason: 'non_string_input',
        message: `Embedding input at index ${String(index)} must be a string.`,
        retryable: false,
        inputIndex: index,
      })
    }
    if (input.trim().length === 0) {
      throw newEmbeddingError({
        code: 'invalid_input',
        reason: 'blank_input',
        message: `Embedding input at index ${String(index)} must not be blank.`,
        retryable: false,
        inputIndex: index,
      })
    }
    validated.push(input)
  }
  return validated
}

// Response validation intentionally keeps every provider-shape check in one boundary.
// eslint-disable-next-line complexity
function validateResponse(
  response: unknown,
  expectedCount: number,
  profile: EmbeddingProfile,
): { vectors: readonly EmbeddingVector[]; usage?: EmbeddingUsage } {
  if (!isRecord(response) || !Array.isArray(response['data'])) {
    throwMalformedResponse('OpenAI embedding response did not contain a data array.')
  }
  const data = response['data'] as unknown[]
  if (data.length !== expectedCount) {
    throw newEmbeddingError({
      code: 'malformed_response',
      message: `OpenAI returned ${String(data.length)} embeddings for ${String(expectedCount)} inputs.`,
      retryable: false,
      expectedCount,
      actualCount: data.length,
    })
  }
  if (
    response['model'] !== undefined &&
    (typeof response['model'] !== 'string' || response['model'] !== profile.model)
  ) {
    throwMalformedResponse('OpenAI returned an unexpected effective embedding model.')
  }

  const vectors: Array<EmbeddingVector | undefined> = new Array<EmbeddingVector | undefined>(
    expectedCount,
  )
  for (const item of data) {
    if (!isRecord(item) || !Number.isInteger(item['index'])) {
      throwMalformedResponse('OpenAI embedding response contained an invalid item index.')
    }
    const index = item['index'] as number
    if (index < 0 || index >= expectedCount || vectors[index] !== undefined) {
      throwMalformedResponse(
        'OpenAI embedding response contained duplicate or out-of-range indices.',
      )
    }
    if (!Array.isArray(item['embedding'])) {
      throwMalformedResponse('OpenAI embedding response contained a non-vector embedding.')
    }
    const embedding = item['embedding'] as unknown[]
    if (embedding.length !== profile.dimensions) {
      throw newEmbeddingError({
        code: 'dimension_mismatch',
        message: `OpenAI returned ${String(embedding.length)} dimensions; expected ${String(profile.dimensions)}.`,
        retryable: false,
        expectedDimensions: profile.dimensions,
        actualDimensions: embedding.length,
        inputIndex: index,
      })
    }
    if (
      !embedding.every(
        (value): value is number => typeof value === 'number' && Number.isFinite(value),
      )
    ) {
      throwMalformedResponse('OpenAI embedding response contained a non-finite vector value.')
    }
    vectors[index] = Object.freeze([...embedding])
  }
  if (vectors.some((vector) => vector === undefined)) {
    throwMalformedResponse('OpenAI embedding response did not contain one vector for every input.')
  }

  const usage = readUsage(response['usage'])
  return usage === undefined
    ? { vectors: vectors as readonly EmbeddingVector[] }
    : { vectors: vectors as readonly EmbeddingVector[], usage }
}

function readUsage(value: unknown): EmbeddingUsage | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) throwMalformedResponse('OpenAI embedding response contained invalid usage.')
  const inputTokens = value['prompt_tokens']
  if (inputTokens === undefined) return undefined
  if (typeof inputTokens !== 'number' || !Number.isFinite(inputTokens) || inputTokens < 0) {
    throwMalformedResponse('OpenAI embedding response contained invalid usage tokens.')
  }
  return { inputTokens }
}

function translateProviderError(error: unknown): EmbeddingAdapterError {
  const status = readStatus(error)
  if (status === 429) {
    return newEmbeddingError({
      code: 'rate_limited',
      message: boundedProviderMessage(error, 'OpenAI embedding request was rate limited.'),
      retryable: true,
    })
  }
  return newEmbeddingError({
    code: 'provider_rejected',
    message: boundedProviderMessage(error, 'OpenAI embedding request failed.'),
    retryable: false,
  })
}

function toEmbeddingFailure(error: unknown): EmbeddingFailure {
  if (isEmbeddingAdapterError(error)) return error.failure
  return {
    code: 'provider_rejected',
    message: boundedProviderMessage(error, 'OpenAI embedding request failed.'),
    retryable: false,
  }
}

function toEmbeddingError(error: unknown, failure: EmbeddingFailure): EmbeddingAdapterError {
  return isEmbeddingAdapterError(error) ? error : newEmbeddingError(failure)
}

function newEmbeddingError(failure: EmbeddingFailure): EmbeddingAdapterError {
  return new EmbeddingAdapterError(failure)
}

function throwMalformedResponse(message: string): never {
  throw newEmbeddingError({
    code: 'malformed_response',
    message,
    retryable: false,
  })
}

function boundedProviderMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : fallback
  const message = raw.replaceAll(/\s+/g, ' ').trim()
  return message.length === 0 ? fallback : message.slice(0, 240)
}

function readStatus(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined
  return typeof error['status'] === 'number' ? error['status'] : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function supportedModel(model: string): boolean {
  return (
    model === 'text-embedding-3-small' ||
    model === 'text-embedding-3-large' ||
    model === 'text-embedding-ada-002'
  )
}

function supportsDimensions(model: string): boolean {
  return model === 'text-embedding-3-small' || model === 'text-embedding-3-large'
}

function maxDimensionsForModel(model: string): number {
  return model === 'text-embedding-3-large' ? 3072 : 1536
}

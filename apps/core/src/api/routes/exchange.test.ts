import { describe, expect, it, vi } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import type { SendRawMessageOutput } from '../../application/use-cases/send-raw-message/send-raw-message.types.js'
import type { Config } from '../../config.js'
import { LlmError, NullLlmAdapter } from '../../infrastructure/llm/index.js'
import { NullObservabilityAdapter } from '../../infrastructure/observability/index.js'
import { createServer } from '../server.js'

const testConfig: Config = {
  port: 3000,
  host: '0.0.0.0',
  nodeEnv: 'test',
  logLevel: 'silent',
  databaseUrl: 'postgresql://test',
  redisUrl: 'redis://test',
  apiKeySecret: 'test-secret',
  llmProvider: 'null',
  openaiApiKey: undefined,
  anthropicApiKey: undefined,
  mistralApiKey: undefined,
  langfusePublicKey: undefined,
  langfuseSecretKey: undefined,
  langfuseHost: undefined,
}

function makeApp(llmReply = 'null adapter response', model = 'null') {
  return createServer(testConfig, {
    llmAdapter: new NullLlmAdapter(llmReply, model),
    observabilityAdapter: new NullObservabilityAdapter(),
  })
}

describe('POST /v1/exchange — auth and validation', () => {
  it('returns 200 with standard envelope when request is valid', async () => {
    const app = makeApp('Arrr, hello!', 'gpt-4o-mini')

    const response = await app.inject({
      method: 'POST',
      url: '/v1/exchange',
      headers: { 'x-api-key': 'test-secret' },
      payload: { message: 'Hello, who are you?', systemPrompt: 'You are a pirate.' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<SendRawMessageOutput>>()
    expect(body.error).toBeNull()
    expect(body.data).not.toBeNull()
    expect(body.data?.reply).toBe('Arrr, hello!')
    expect(body.data?.model).toBe('gpt-4o-mini')
    expect(typeof body.data?.requestId).toBe('string')
  })

  it('returns 401 when API key is missing', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/v1/exchange',
      payload: { message: 'Hello' },
    })

    expect(response.statusCode).toBe(401)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('UNAUTHORIZED')
    expect(body.error?.message).toBe('Invalid API key')
  })

  it('returns 401 when API key is wrong', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/v1/exchange',
      headers: { 'x-api-key': 'wrong-secret' },
      payload: { message: 'Hello' },
    })

    expect(response.statusCode).toBe(401)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('UNAUTHORIZED')
    expect(body.error?.message).toBe('Invalid API key')
  })

  it('returns 400 when message field is missing', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/v1/exchange',
      headers: { 'x-api-key': 'test-secret' },
      payload: {},
    })

    expect(response.statusCode).toBe(400)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when message is an empty string', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/v1/exchange',
      headers: { 'x-api-key': 'test-secret' },
      payload: { message: '' },
    })

    expect(response.statusCode).toBe(400)
    const body = response.json<ApiResponse<null>>()
    expect(body.error?.code).toBe('VALIDATION_ERROR')
  })
})

describe('POST /v1/exchange — error handling and response shaping', () => {
  it('returns 502 when the LLM adapter throws a LlmError', async () => {
    const failingLlm = {
      complete: vi.fn().mockRejectedValue(new LlmError('openai', 'Provider timeout', 504)),
    }
    const app = createServer(testConfig, {
      llmAdapter: failingLlm,
      observabilityAdapter: new NullObservabilityAdapter(),
    })

    const response = await app.inject({
      method: 'POST',
      url: '/v1/exchange',
      headers: { 'x-api-key': 'test-secret' },
      payload: { message: 'Hello' },
    })

    expect(response.statusCode).toBe(502)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('EXTERNAL_SERVICE_ERROR')
  })

  it('returns 500 on unexpected errors from the use case', async () => {
    const crashingLlm = {
      complete: vi.fn().mockRejectedValue(new Error('Unexpected crash')),
    }
    const app = createServer(testConfig, {
      llmAdapter: crashingLlm,
      observabilityAdapter: new NullObservabilityAdapter(),
    })

    const response = await app.inject({
      method: 'POST',
      url: '/v1/exchange',
      headers: { 'x-api-key': 'test-secret' },
      payload: { message: 'Hello' },
    })

    expect(response.statusCode).toBe(500)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('INTERNAL_ERROR')
  })

  it('respects the systemPrompt field when provided', async () => {
    const response = await makeApp('Arr pir8!').inject({
      method: 'POST',
      url: '/v1/exchange',
      headers: { 'x-api-key': 'test-secret' },
      payload: { message: 'Hello', systemPrompt: 'You are a pirate.' },
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<SendRawMessageOutput>>()
    expect(body.data?.reply).toBe('Arr pir8!')
  })
})

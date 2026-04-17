import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import type { SendRawMessageOutput } from '../../application/use-cases/send-raw-message/send-raw-message.types.js'
import type { Config } from '../../config.js'
import { NullLlmAdapter } from '../../infrastructure/llm/index.js'
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

describe('POST /v1/exchange', () => {
  it('returns 200 with standard envelope when request is valid', async () => {
    const app = createServer(testConfig, {
      llmAdapter: new NullLlmAdapter('Arrr, hello!', 'gpt-4o-mini'),
      observabilityAdapter: new NullObservabilityAdapter(),
    })

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
    const app = createServer(testConfig, {
      llmAdapter: new NullLlmAdapter(),
      observabilityAdapter: new NullObservabilityAdapter(),
    })

    const response = await app.inject({
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
    const app = createServer(testConfig, {
      llmAdapter: new NullLlmAdapter(),
      observabilityAdapter: new NullObservabilityAdapter(),
    })

    const response = await app.inject({
      method: 'POST',
      url: '/v1/exchange',
      headers: { 'x-api-key': 'wrong-secret' },
      payload: { message: 'Hello' },
    })

    expect(response.statusCode).toBe(401)
    const body = response.json<ApiResponse<null>>()
    expect(body.data).toBeNull()
    expect(body.error?.code).toBe('UNAUTHORIZED')
    expect(body.error?.message).toBe('Invalid API key')
  })

  it('returns 400 when message field is missing', async () => {
    const app = createServer(testConfig, {
      llmAdapter: new NullLlmAdapter(),
      observabilityAdapter: new NullObservabilityAdapter(),
    })

    const response = await app.inject({
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
})

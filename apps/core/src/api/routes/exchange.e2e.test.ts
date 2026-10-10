/** Runs only when the corresponding provider credential is configured. */
import { describe, expect, it } from 'vitest'
import type { ApiResponse, RawExchangeResponse } from '@gami/shared'
import type { Config } from '../../config.js'
import { skipIfTransientProviderHttpError } from '../../test-utils/real-provider.js'
import { createServer } from '../server.js'
import { TEST_CONFIG } from './test-config.js'

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    ...TEST_CONFIG,
    apiKeySecret: 'e2e-secret',
    openaiApiKey: process.env['OPENAI_API_KEY'],
    anthropicApiKey: process.env['ANTHROPIC_API_KEY'],
    mistralApiKey: process.env['MISTRAL_API_KEY'],
    xaiApiKey: process.env['XAI_API_KEY'],
    langfusePublicKey: process.env['LANGFUSE_PUBLIC_KEY'],
    langfuseSecretKey: process.env['LANGFUSE_SECRET_KEY'],
    langfuseHost: process.env['LANGFUSE_BASE_URL'],
    ...overrides,
  }
}

const openaiKey = process.env['OPENAI_API_KEY']

describe.skipIf(!openaiKey)('E2E — POST /v1/exchange with real OpenAI', () => {
  it('returns a non-empty reply and full token metrics', async (context) => {
    const app = createServer(makeConfig({ llmProvider: 'openai' }))

    const response = await app.inject({
      method: 'POST',
      url: '/v1/exchange',
      headers: { 'x-api-key': 'e2e-secret' },
      payload: {
        message: 'Reply with exactly two words: "test passed".',
        systemPrompt: 'You are a terse assistant. Follow instructions precisely.',
      },
    })
    await app.close()

    const body = response.json<ApiResponse<RawExchangeResponse>>()
    skipIfTransientProviderHttpError(context, 'OpenAI', response.statusCode, body.error?.message)
    expect(response.statusCode).toBe(200)
    expect(body.error).toBeNull()
    expect(body.data).not.toBeNull()
    expect(body.data?.reply).toBeTruthy()
    expect(body.data?.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(body.data?.inputTokens).toBeGreaterThan(0)
    expect(body.data?.outputTokens).toBeGreaterThan(0)
    expect(body.data?.latencyMs).toBeGreaterThan(0)
  }, 30_000)
})

const anthropicKey = process.env['ANTHROPIC_API_KEY']

describe.skipIf(!anthropicKey)('E2E — POST /v1/exchange with real Anthropic', () => {
  it('returns a non-empty reply and full token metrics', async (context) => {
    const app = createServer(makeConfig({ llmProvider: 'anthropic' }))

    const response = await app.inject({
      method: 'POST',
      url: '/v1/exchange',
      headers: { 'x-api-key': 'e2e-secret' },
      payload: {
        message: 'Reply with exactly two words: "test passed".',
        systemPrompt: 'You are a terse assistant. Follow instructions precisely.',
      },
    })
    await app.close()

    const body = response.json<ApiResponse<RawExchangeResponse>>()
    skipIfTransientProviderHttpError(context, 'Anthropic', response.statusCode, body.error?.message)
    expect(response.statusCode).toBe(200)
    expect(body.error).toBeNull()
    expect(body.data?.reply).toBeTruthy()
    expect(body.data?.inputTokens).toBeGreaterThan(0)
    expect(body.data?.outputTokens).toBeGreaterThan(0)
    expect(body.data?.latencyMs).toBeGreaterThan(0)
  }, 30_000)
})

const mistralKey = process.env['MISTRAL_API_KEY']

describe.skipIf(!mistralKey)('E2E — POST /v1/exchange with real Mistral', () => {
  it('returns a non-empty reply and full token metrics', async (context) => {
    const app = createServer(makeConfig({ llmProvider: 'mistral' }))

    const response = await app.inject({
      method: 'POST',
      url: '/v1/exchange',
      headers: { 'x-api-key': 'e2e-secret' },
      payload: {
        message: 'Reply with exactly two words: "test passed".',
        systemPrompt: 'You are a terse assistant. Follow instructions precisely.',
      },
    })
    await app.close()

    const body = response.json<ApiResponse<RawExchangeResponse>>()
    skipIfTransientProviderHttpError(context, 'Mistral', response.statusCode, body.error?.message)
    expect(response.statusCode).toBe(200)
    expect(body.error).toBeNull()
    expect(body.data?.reply).toBeTruthy()
    expect(body.data?.inputTokens).toBeGreaterThan(0)
    expect(body.data?.outputTokens).toBeGreaterThan(0)
    expect(body.data?.latencyMs).toBeGreaterThan(0)
  }, 30_000)
})

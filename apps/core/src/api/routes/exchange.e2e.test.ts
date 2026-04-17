/**
 * E2E tests — real LLM calls through the full HTTP stack.
 *
 * These tests exercise the complete request path:
 *   HTTP POST /v1/exchange → exchangeRoute → SendRawMessageUseCase → real LLM API
 *
 * They are skipped automatically when the required API key is absent (CI without
 * live credentials). Run locally with a populated .env file.
 *
 * Do NOT mock anything here — the goal is to verify the end-to-end product.
 */
import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import type { SendRawMessageOutput } from '../../application/use-cases/send-raw-message/send-raw-message.types.js'
import type { Config } from '../../config.js'
import { createServer } from '../server.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    port: 3000,
    host: '0.0.0.0',
    nodeEnv: 'test',
    logLevel: 'silent',
    databaseUrl: 'postgresql://test',
    redisUrl: 'redis://test',
    apiKeySecret: 'e2e-secret',
    llmProvider: overrides.llmProvider ?? 'null',
    openaiApiKey: process.env['OPENAI_API_KEY'],
    anthropicApiKey: process.env['ANTHROPIC_API_KEY'],
    mistralApiKey: process.env['MISTRAL_API_KEY'],
    langfusePublicKey: undefined,
    langfuseSecretKey: undefined,
    langfuseHost: undefined,
    ...overrides,
  }
}

// ── OpenAI E2E ────────────────────────────────────────────────────────────────

const openaiKey = process.env['OPENAI_API_KEY']

describe.skipIf(!openaiKey)('E2E — POST /v1/exchange with real OpenAI', () => {
  it('returns a non-empty reply and full token metrics', async () => {
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

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<SendRawMessageOutput>>()
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

// ── Anthropic E2E ─────────────────────────────────────────────────────────────

const anthropicKey = process.env['ANTHROPIC_API_KEY']

describe.skipIf(!anthropicKey)('E2E — POST /v1/exchange with real Anthropic', () => {
  it('returns a non-empty reply and full token metrics', async () => {
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

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<SendRawMessageOutput>>()
    expect(body.error).toBeNull()
    expect(body.data?.reply).toBeTruthy()
    expect(body.data?.inputTokens).toBeGreaterThan(0)
    expect(body.data?.outputTokens).toBeGreaterThan(0)
    expect(body.data?.latencyMs).toBeGreaterThan(0)
  }, 30_000)
})

// ── Mistral E2E ───────────────────────────────────────────────────────────────

const mistralKey = process.env['MISTRAL_API_KEY']

describe.skipIf(!mistralKey)('E2E — POST /v1/exchange with real Mistral', () => {
  it('returns a non-empty reply and full token metrics', async () => {
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

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<SendRawMessageOutput>>()
    expect(body.error).toBeNull()
    expect(body.data?.reply).toBeTruthy()
    expect(body.data?.inputTokens).toBeGreaterThan(0)
    expect(body.data?.outputTokens).toBeGreaterThan(0)
    expect(body.data?.latencyMs).toBeGreaterThan(0)
  }, 30_000)
})

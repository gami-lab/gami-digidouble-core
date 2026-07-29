/**
 * Stack E2E — POST /v1/exchange
 *
 * Fires real HTTP requests against the running Docker stack.
 * No mocking. Requires APP_URL to point to a live server.
 *
 * Always-on tests (null LLM provider — no API key required):
 *   - auth rejection for missing / wrong key
 *   - schema validation rejection
 *   - valid exchange returns correct response shape
 *
 * The Docker stack is configured with API_KEY_SECRET=e2e-stack-secret and
 * LLM_PROVIDER=${LLM_PROVIDER:-null} (see docker-compose.e2e.yml).
 */
import { describe, expect, it } from 'vitest'
import type { ApiResponse, RawExchangeResponse } from '@gami/shared'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const API_KEY = 'e2e-stack-secret'

// ── Auth guard tests (always run) ────────────────────────────────────────────

describe('Stack E2E — POST /v1/exchange — auth', () => {
  it('rejects requests with no API key (401)', async () => {
    const res = await fetch(`${APP_URL}/v1/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hello' }),
    })

    expect(res.status).toBe(401)
  })

  it('rejects requests with wrong API key (401)', async () => {
    const res = await fetch(`${APP_URL}/v1/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'wrong-key',
      },
      body: JSON.stringify({ message: 'hello' }),
    })

    expect(res.status).toBe(401)
  })

  it('rejects requests with missing message field (400)', async () => {
    const res = await fetch(`${APP_URL}/v1/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
  })
})

// ── Null provider — always runs (no LLM key required) ────────────────────────
//
// Uses the null adapter to validate the full stack (HTTP → app → DB → Redis)
// without any external dependencies. Runs regardless of LLM_PROVIDER.

const isNullProvider = (process.env['LLM_PROVIDER'] ?? 'null') === 'null'

describe('Stack E2E — POST /v1/exchange — null provider (always-on)', () => {
  it('returns 200 with correct response envelope', async () => {
    const res = await fetch(`${APP_URL}/v1/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        message: 'hello',
        systemPrompt: 'You are a test assistant.',
      }),
    })

    expect(res.status).toBe(200)

    const body = (await res.json()) as ApiResponse<RawExchangeResponse>
    expect(body.error).toBeNull()
    expect(body.data).not.toBeNull()
    expect(body.data?.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(typeof body.data?.latencyMs).toBe('number')
  })
})

describe('Stack E2E — POST /v1/exchange — provider-backed flow', () => {
  it('returns a non-empty reply with token counts', async () => {
    const res = await fetch(`${APP_URL}/v1/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({
        message: 'Reply with exactly two words: "stack ok".',
        systemPrompt: 'You are a terse assistant. Follow instructions precisely.',
      }),
    })

    expect(res.status).toBe(200)

    const body = (await res.json()) as ApiResponse<RawExchangeResponse>
    expect(body.error).toBeNull()
    expect(body.data?.reply).toBeTruthy()
    expect(body.data?.inputTokens).toBeGreaterThan(0)
    expect(body.data?.outputTokens).toBeGreaterThan(0)
    expect(body.data?.latencyMs).toBeGreaterThan(0)
    if (!isNullProvider) {
      expect(body.data?.model).toBeTruthy()
    }
  })
})

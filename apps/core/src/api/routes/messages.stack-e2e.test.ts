/**
 * Stack E2E — POST /v1/conversations/:sessionId/messages
 *
 * Fires real HTTP requests against the running Docker stack.
 * No mocking. Requires APP_URL to point to a live server.
 *
 * Always-on tests (no LLM key or session seeding required):
 *   - auth rejection for missing / wrong key
 *   - schema validation rejection (missing required fields)
 *   - unknown session returns 404 with correct error code
 *
 * Full happy-path stack test (deferred):
 *   A success-path test requires a pre-seeded session and avatar in the DB.
 *   This will be added once a session-creation API endpoint exists (planned
 *   for the Core Public API epic). For now, the happy path is covered by the
 *   in-process E2E (messages.e2e.test.ts) and unit/API tests (messages.test.ts).
 *
 * The Docker stack is configured with API_KEY_SECRET=e2e-stack-secret and
 * LLM_PROVIDER=${LLM_PROVIDER:-null} (see docker-compose.e2e.yml).
 */
import { describe, expect, it } from 'vitest'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const API_KEY = 'e2e-stack-secret'
const ENDPOINT = `${APP_URL}/v1/conversations/sess_unknown/messages`

// ── Auth guard tests (always run) ────────────────────────────────────────────

describe('Stack E2E — POST /v1/conversations/:sessionId/messages — auth', () => {
  it('rejects requests with no API key (401)', async () => {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarId: 'ava_test', message: { content: 'hello' } }),
    })

    expect(res.status).toBe(401)
  })

  it('rejects requests with wrong API key (401)', async () => {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'wrong-key',
      },
      body: JSON.stringify({ avatarId: 'ava_test', message: { content: 'hello' } }),
    })

    expect(res.status).toBe(401)
  })
})

// ── Schema validation tests (always run) ─────────────────────────────────────

describe('Stack E2E — POST /v1/conversations/:sessionId/messages — validation', () => {
  it('rejects requests with missing message field (400)', async () => {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ avatarId: 'ava_test' }),
    })

    expect(res.status).toBe(400)
  })

  it('rejects requests with missing avatarId field (400)', async () => {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ message: { content: 'hello' } }),
    })

    expect(res.status).toBe(400)
  })

  it('rejects requests with empty message content (400)', async () => {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ avatarId: 'ava_test', message: { content: '' } }),
    })

    expect(res.status).toBe(400)
  })
})

// ── Resource lookup (always run) ──────────────────────────────────────────────

describe('Stack E2E — POST /v1/conversations/:sessionId/messages — resource lookup', () => {
  it('returns 404 for an unknown sessionId with correct error envelope', async () => {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ avatarId: 'ava_test', message: { content: 'hello' } }),
    })

    expect(res.status).toBe(404)

    const body = (await res.json()) as { data: null; error: { code: string } }
    expect(body.data).toBeNull()
    expect(body.error).not.toBeNull()
    expect(body.error.code).toBe('SESSION_NOT_FOUND')
  })
})

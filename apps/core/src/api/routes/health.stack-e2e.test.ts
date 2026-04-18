/**
 * Stack E2E — GET /health
 *
 * Fires a real HTTP request against the running Docker stack.
 * No mocking. Requires APP_URL to point to a live server.
 */
import { describe, expect, it } from 'vitest'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'

describe('Stack E2E — GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await fetch(`${APP_URL}/health`)

    expect(res.status).toBe(200)

    const body = (await res.json()) as { status: string }
    expect(body.status).toBe('ok')
  })
})

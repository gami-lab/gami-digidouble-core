import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import type { IRateLimiter } from '../application/ports/IRateLimiter.js'
import { InMemoryRateLimiter } from '../application/rate-limit/in-memory-rate-limiter.js'
import { DEFAULT_RATE_LIMIT_POLICIES } from '../application/rate-limit/rate-limit-policies.js'
import type { Config } from '../config.js'
import { createServer } from './server.js'
import { TEST_CONFIG } from './routes/test-config.js'
import { playerHeaders } from './routes/test-auth.js'

const config: Config = {
  ...TEST_CONFIG,
  rateLimits: {
    ...DEFAULT_RATE_LIMIT_POLICIES,
    playerToken: { max: 2, windowSeconds: 60 },
    message: { max: 1, windowSeconds: 30 },
  },
}

function issueToken(app: ReturnType<typeof createServer>, remoteAddress: string) {
  return app.inject({ method: 'POST', url: '/v1/auth/player', remoteAddress })
}

describe('rate limits', () => {
  it('limits token issue per client IP and returns 429 with Retry-After', async () => {
    const app = createServer(config, { rateLimiter: new InMemoryRateLimiter() })

    const first = await issueToken(app, '203.0.113.1')
    await issueToken(app, '203.0.113.1')
    const limited = await issueToken(app, '203.0.113.1')
    const otherClient = await issueToken(app, '203.0.113.2')

    expect(first.statusCode).toBe(200)
    expect(limited.statusCode).toBe(429)
    expect(limited.headers['retry-after']).toBe('60')
    expect(limited.json<ApiResponse<null>>().error?.code).toBe('RATE_LIMITED')
    expect(otherClient.statusCode).toBe(200)
  })

  it('limits message routes per player, leaving other players unaffected', async () => {
    const app = createServer(config, { rateLimiter: new InMemoryRateLimiter() })
    const send = (userId: string) =>
      app.inject({
        method: 'POST',
        url: '/v1/conversations/conversation_none/messages',
        headers: playerHeaders(userId),
        payload: { message: { content: 'Hi' } },
      })

    const first = await send('user_a')
    const limited = await send('user_a')
    const otherPlayer = await send('user_b')

    expect(first.statusCode).toBe(404)
    expect(limited.statusCode).toBe(429)
    expect(limited.headers['retry-after']).toBe('30')
    expect(otherPlayer.statusCode).toBe(404)
  })

  it('keys open routes on the client IP behind a trusted proxy', async () => {
    const app = createServer(
      { ...config, trustProxyHops: 1 },
      { rateLimiter: new InMemoryRateLimiter() },
    )
    const viaProxy = (client: string) =>
      app.inject({
        method: 'POST',
        url: '/v1/auth/player',
        remoteAddress: '10.0.0.1',
        headers: { 'x-forwarded-for': client },
      })

    await viaProxy('198.51.100.1')
    await viaProxy('198.51.100.1')
    const limited = await viaProxy('198.51.100.1')
    const otherClient = await viaProxy('198.51.100.2')

    expect(limited.statusCode).toBe(429)
    expect(otherClient.statusCode).toBe(200)
  })

  it('fails open when the limiter is unavailable', async () => {
    const brokenLimiter: IRateLimiter = {
      consume: () => Promise.reject(new Error('redis down')),
    }
    const app = createServer(config, { rateLimiter: brokenLimiter })

    const responses = await Promise.all([1, 2, 3].map(() => issueToken(app, '203.0.113.9')))

    expect(responses.map((response) => response.statusCode)).toEqual([200, 200, 200])
  })

  it('declares a policy on every listed abuse-prone route', async () => {
    const app = createServer(TEST_CONFIG)
    const policies = new Map<string, unknown>()
    app.addHook('onRoute', (route) => {
      policies.set(`${String(route.method)} ${route.url.replace(/(.)\/$/, '$1')}`, route)
    })
    await app.ready()
    const policyOf = (key: string) =>
      (policies.get(key) as { config?: { rateLimit?: string } } | undefined)?.config?.rateLimit

    expect(
      [
        'POST /v1/auth/player',
        'POST /v1/admin/auth/login',
        'POST /v1/sessions',
        'POST /v1/conversations/:conversationId/messages',
        'POST /v1/conversations/:conversationId/messages/stream',
        'POST /v1/conversations/:conversationId/voice-messages',
        'POST /v1/conversations/:conversationId/voice-messages/stream',
        'POST /v1/conversations/:conversationId/messages/:messageId/audio',
      ].map(policyOf),
    ).toEqual([
      'playerToken',
      'adminLogin',
      'sessionStart',
      'message',
      'message',
      'voice',
      'voice',
      'audio',
    ])
    await app.close()
  })
})

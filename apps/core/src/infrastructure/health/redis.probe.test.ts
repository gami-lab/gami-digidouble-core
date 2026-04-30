import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Redis } from 'ioredis'
import { RedisProbe } from './redis.probe.js'

function createRedisMock(overrides?: Partial<Pick<Redis, 'ping'>>): Redis {
  return {
    ping: vi.fn().mockResolvedValue('PONG'),
    ...overrides,
  } as unknown as Redis
}

describe('RedisProbe', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns healthy when ping succeeds with PONG', async () => {
    const client = createRedisMock()
    const probe = new RedisProbe(client)

    const result = await probe.probe()

    expect(result.name).toBe('redis')
    expect(result.status).toBe('healthy')
    expect(typeof result.latencyMs).toBe('number')
    expect(result.message).toBeUndefined()
  })

  it('returns degraded when ping response is not PONG', async () => {
    const client = createRedisMock({ ping: vi.fn().mockResolvedValue('NOPE') })
    const probe = new RedisProbe(client)

    const result = await probe.probe()

    expect(result).toMatchObject({
      name: 'redis',
      status: 'degraded',
      message: 'Unexpected ping response: NOPE',
    })
  })

  it('returns degraded with message when ping throws', async () => {
    const client = createRedisMock({ ping: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) })
    const probe = new RedisProbe(client)

    const result = await probe.probe()

    expect(result).toMatchObject({
      name: 'redis',
      status: 'degraded',
      message: 'ECONNREFUSED',
    })
  })

  it('returns degraded on timeout within 3.1 seconds', async () => {
    vi.useFakeTimers()
    const client = createRedisMock({ ping: vi.fn().mockReturnValue(new Promise(() => undefined)) })
    const probe = new RedisProbe(client)

    const startedAt = Date.now()
    const probePromise = probe.probe()

    await vi.advanceTimersByTimeAsync(3_000)
    const result = await probePromise
    const elapsedMs = Date.now() - startedAt

    expect(result).toMatchObject({
      name: 'redis',
      status: 'degraded',
      message: 'probe timed out',
    })
    expect(elapsedMs).toBeLessThanOrEqual(3_100)
  })
})

import { describe, expect, it } from 'vitest'
import { RedisUtteranceIdempotencyStore } from './redis-utterance-idempotency.store.js'

const identity = { conversationId: 'conversation-1', utteranceId: 'utterance-1' }

class FakeRedis {
  private readonly values = new Map<string, string>()

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.values.get(key) ?? null)
  }

  set(key: string, value: string, mode?: 'NX' | 'XX'): Promise<'OK' | null> {
    if (mode === 'NX' && this.values.has(key)) return Promise.resolve(null)
    if (mode === 'XX' && !this.values.has(key)) return Promise.resolve(null)
    this.values.set(key, value)
    return Promise.resolve('OK')
  }

  del(key: string): Promise<number> {
    if (!this.values.has(key)) return Promise.resolve(0)
    this.values.delete(key)
    return Promise.resolve(1)
  }

  putRaw(key: string, value: string): Promise<void> {
    this.values.set(key, value)
    return Promise.resolve()
  }
}

describe('RedisUtteranceIdempotencyStore', () => {
  it('claims one utterance and reports an identical duplicate as in-flight', async () => {
    const redis = new FakeRedis()
    const store = new RedisUtteranceIdempotencyStore(redis, 100, () => 1_000)

    const first = await store.reserve(identity, 'fingerprint-a')
    const duplicate = await store.reserve(identity, 'fingerprint-a')

    expect(first).toMatchObject({ status: 'claimed', expiresAt: 1_100 })
    expect(duplicate).toEqual({ status: 'in_flight' })
  })

  it('keeps a completed identity terminal so replay cannot execute another turn', async () => {
    const redis = new FakeRedis()
    const store = new RedisUtteranceIdempotencyStore(redis)

    const first = await store.reserve(identity, 'fingerprint-a', 1_000)
    if (first.status !== 'claimed') throw new Error('Expected claimed reservation')

    await expect(store.complete(identity, first.reservationId)).resolves.toBe(true)
    await expect(store.reserve(identity, 'fingerprint-a', 1_001)).resolves.toEqual({
      status: 'completed',
    })
  })

  it('fails safe when an in-flight reservation expires', async () => {
    const redis = new FakeRedis()
    const store = new RedisUtteranceIdempotencyStore(redis, 100)

    await store.reserve(identity, 'fingerprint-a', 1_000)
    await expect(store.reserve(identity, 'fingerprint-a', 1_100)).resolves.toEqual({
      status: 'expired',
    })
    await expect(store.reserve(identity, 'fingerprint-a', 2_000)).resolves.toEqual({
      status: 'expired',
    })
  })

  it('rejects a conflicting duplicate identity with a different fingerprint', async () => {
    const redis = new FakeRedis()
    const store = new RedisUtteranceIdempotencyStore(redis)

    await store.reserve(identity, 'fingerprint-a', 1_000)
    await expect(store.reserve(identity, 'fingerprint-b', 1_001)).resolves.toEqual({
      status: 'conflict',
    })
  })

  it('allows a released in-flight reservation to be retried', async () => {
    const redis = new FakeRedis()
    const store = new RedisUtteranceIdempotencyStore(redis)

    const first = await store.reserve(identity, 'fingerprint-a', 1_000)
    if (first.status !== 'claimed') throw new Error('Expected claimed reservation')

    await expect(store.release(identity, first.reservationId)).resolves.toBe(true)
    await expect(store.reserve(identity, 'fingerprint-a', 1_001)).resolves.toMatchObject({
      status: 'claimed',
    })
  })

  it('drops malformed stored payloads and allows a fresh claim', async () => {
    const redis = new FakeRedis()
    await redis.putRaw('voice:utterance:["conversation-1","utterance-1"]', 'not-json')
    const store = new RedisUtteranceIdempotencyStore(redis)

    await expect(store.reserve(identity, 'fingerprint-a', 1_000)).resolves.toMatchObject({
      status: 'claimed',
    })
  })
})

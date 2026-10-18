import { describe, expect, it } from 'vitest'
import { RedisAdminSessionStore } from './redis-admin-session.store.js'

function createFakeRedis() {
  const values = new Map<string, { value: string; ttlSeconds: number }>()
  return {
    values,
    set: (key: string, value: string, _expiry: 'EX', seconds: number) => {
      values.set(key, { value, ttlSeconds: seconds })
      return Promise.resolve('OK' as const)
    },
    exists: (key: string) => Promise.resolve(values.has(key) ? 1 : 0),
    del: (key: string) => Promise.resolve(values.delete(key) ? 1 : 0),
  }
}

describe('RedisAdminSessionStore', () => {
  it('writes every session under a prefixed key with a Redis expiry', async () => {
    const redis = createFakeRedis()
    const store = new RedisAdminSessionStore(redis)

    await store.create('derived-key', 3600)

    expect(redis.values.get('admin_session:derived-key')).toEqual({ value: '1', ttlSeconds: 3600 })
    await expect(store.exists('derived-key')).resolves.toBe(true)
    await store.delete('derived-key')
    await expect(store.exists('derived-key')).resolves.toBe(false)
  })
})

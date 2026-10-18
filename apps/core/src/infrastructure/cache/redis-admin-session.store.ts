import type { IAdminSessionStore } from '../../application/ports/IAdminSessionStore.js'

type RedisSessionClient = {
  set(key: string, value: string, expiry: 'EX', seconds: number): Promise<'OK' | null>
  exists(key: string): Promise<number>
  del(key: string): Promise<number>
}

const KEY_PREFIX = 'admin_session:'

/** Admin sessions shared across Core instances; Redis expiry bounds every session. */
export class RedisAdminSessionStore implements IAdminSessionStore {
  constructor(private readonly redis: RedisSessionClient) {}

  async create(sessionKey: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(`${KEY_PREFIX}${sessionKey}`, '1', 'EX', ttlSeconds)
  }

  async exists(sessionKey: string): Promise<boolean> {
    return (await this.redis.exists(`${KEY_PREFIX}${sessionKey}`)) === 1
  }

  async delete(sessionKey: string): Promise<void> {
    await this.redis.del(`${KEY_PREFIX}${sessionKey}`)
  }
}

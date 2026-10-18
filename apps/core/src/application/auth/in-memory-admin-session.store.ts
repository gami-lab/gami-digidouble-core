import type { IAdminSessionStore } from '../ports/IAdminSessionStore.js'

/** Process-local admin sessions for tests and single-process development. */
export class InMemoryAdminSessionStore implements IAdminSessionStore {
  private readonly expiries = new Map<string, number>()

  constructor(private readonly now: () => number = Date.now) {}

  create(sessionKey: string, ttlSeconds: number): Promise<void> {
    this.expiries.set(sessionKey, this.now() + ttlSeconds * 1_000)
    return Promise.resolve()
  }

  exists(sessionKey: string): Promise<boolean> {
    const expiresAt = this.expiries.get(sessionKey)
    if (expiresAt === undefined) return Promise.resolve(false)
    if (expiresAt <= this.now()) {
      this.expiries.delete(sessionKey)
      return Promise.resolve(false)
    }
    return Promise.resolve(true)
  }

  delete(sessionKey: string): Promise<void> {
    this.expiries.delete(sessionKey)
    return Promise.resolve()
  }
}

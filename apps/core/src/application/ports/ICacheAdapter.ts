/**
 * Port: cache / session adapter.
 *
 * Used for session hot data and context prefetch.
 * Concrete adapter in infrastructure/cache/ wraps Redis.
 */
export interface ICacheAdapter {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>
  del(key: string): Promise<void>
}

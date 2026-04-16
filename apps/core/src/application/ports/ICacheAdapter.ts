/**
 * Port: cache / session adapter.
 *
 * Used for session hot data and context prefetch.
 * Concrete adapter in infrastructure/cache/ wraps Redis.
 */
export interface ICacheAdapter {
  get<T>(key: string): Promise<T | null>
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>
  del(key: string): Promise<void>
}

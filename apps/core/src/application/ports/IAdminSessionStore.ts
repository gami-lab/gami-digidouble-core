/**
 * Stores admin sign-in sessions by an opaque key. Keys are derived from the session id by the
 * application, so the store never sees a usable cookie value.
 */
export interface IAdminSessionStore {
  create(sessionKey: string, ttlSeconds: number): Promise<void>
  exists(sessionKey: string): Promise<boolean>
  delete(sessionKey: string): Promise<void>
}

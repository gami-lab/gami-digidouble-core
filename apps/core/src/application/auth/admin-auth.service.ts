import { createHmac, randomBytes } from 'node:crypto'
import type { IAdminSessionStore } from '../ports/IAdminSessionStore.js'

/** Checks an operator credential; a password today, replaceable by OIDC without route changes. */
export type AdminCredentialVerifier = (password: string) => Promise<boolean>

export type AdminAuthServiceOptions = {
  store: IAdminSessionStore
  verifyCredential: AdminCredentialVerifier
  sessionSecret: string
  sessionTtlSeconds: number
  now?: () => number
}

export type AdminSignIn = {
  sessionId: string
  expiresAt: string
}

const SESSION_ID_BYTES = 32

export class AdminAuthService {
  private readonly now: () => number

  constructor(private readonly options: AdminAuthServiceOptions) {
    this.now = options.now ?? Date.now
  }

  get sessionTtlSeconds(): number {
    return this.options.sessionTtlSeconds
  }

  async signIn(password: string): Promise<AdminSignIn | null> {
    if (!(await this.options.verifyCredential(password))) return null

    const sessionId = randomBytes(SESSION_ID_BYTES).toString('base64url')
    await this.options.store.create(this.toSessionKey(sessionId), this.options.sessionTtlSeconds)
    return {
      sessionId,
      expiresAt: new Date(this.now() + this.options.sessionTtlSeconds * 1_000).toISOString(),
    }
  }

  async isSignedIn(sessionId: string): Promise<boolean> {
    return await this.options.store.exists(this.toSessionKey(sessionId))
  }

  async signOut(sessionId: string): Promise<void> {
    await this.options.store.delete(this.toSessionKey(sessionId))
  }

  private toSessionKey(sessionId: string): string {
    return createHmac('sha256', this.options.sessionSecret).update(sessionId).digest('base64url')
  }
}

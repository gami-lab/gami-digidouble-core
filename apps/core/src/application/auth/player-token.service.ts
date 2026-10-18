import { createHmac, randomUUID } from 'node:crypto'
import { areSecretsEqual } from './secret-compare.js'

export type PlayerTokenServiceOptions = {
  secret: string
  ttlSeconds: number
  /** How long after expiry a signed token may still be exchanged for a fresh one. */
  refreshWindowSeconds: number
  now?: () => number
}

export type PlayerTokenGrant = {
  userId: string
  token: string
  expiresAt: string
}

type PlayerTokenClaims = {
  userId: string
  expiresAtSeconds: number
}

const TOKEN_VERSION = 1

/**
 * Core-issued player identity: an HMAC-SHA256 signed `{ v, sub, iat, exp }` payload. Core never
 * accepts a client-chosen user id; the token is the only source of a player's `userId`.
 */
export class PlayerTokenService {
  private readonly now: () => number

  constructor(private readonly options: PlayerTokenServiceOptions) {
    this.now = options.now ?? Date.now
  }

  createPlayer(): PlayerTokenGrant {
    return this.issue(`user_${randomUUID()}`)
  }

  issue(userId: string): PlayerTokenGrant {
    const issuedAt = Math.floor(this.now() / 1_000)
    const expiresAt = issuedAt + this.options.ttlSeconds
    const payload = Buffer.from(
      JSON.stringify({ v: TOKEN_VERSION, sub: userId, iat: issuedAt, exp: expiresAt }),
    ).toString('base64url')
    return {
      userId,
      token: `${payload}.${this.sign(payload)}`,
      expiresAt: new Date(expiresAt * 1_000).toISOString(),
    }
  }

  /** Returns the player id of a valid, unexpired token, otherwise `null`. */
  verify(token: string): string | null {
    const claims = this.readClaims(token)
    if (claims === null || claims.expiresAtSeconds <= this.nowSeconds()) return null
    return claims.userId
  }

  /** Issues a fresh token for a signed token that is unexpired or within the refresh window. */
  refresh(token: string): PlayerTokenGrant | null {
    const claims = this.readClaims(token)
    if (claims === null) return null
    if (claims.expiresAtSeconds + this.options.refreshWindowSeconds <= this.nowSeconds())
      return null
    return this.issue(claims.userId)
  }

  private readClaims(token: string): PlayerTokenClaims | null {
    const [payload, signature, ...rest] = token.split('.')
    if (payload === undefined || signature === undefined || rest.length > 0) return null
    if (!areSecretsEqual(signature, this.sign(payload))) return null
    return parseClaims(payload)
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.options.secret).update(payload).digest('base64url')
  }

  private nowSeconds(): number {
    return Math.floor(this.now() / 1_000)
  }
}

function parseClaims(payload: string): PlayerTokenClaims | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const { v, sub, exp } = parsed as Record<string, unknown>
  if (v !== TOKEN_VERSION || typeof sub !== 'string' || sub.length === 0) return null
  return typeof exp === 'number' ? { userId: sub, expiresAtSeconds: exp } : null
}

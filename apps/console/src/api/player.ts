import type { AdminSessionInspectResponse, PlayerTokenResponse } from '@gami/shared'
import { coreRequest } from './client'

type HttpMethod = 'GET' | 'POST'

/** Re-issue a little before expiry so an in-flight request never carries an expired token. */
const REFRESH_MARGIN_MS = 60_000

const tokens = new Map<string, PlayerTokenResponse>()
const sessionOwners = new Map<string, string>()

/** A player token for `userId`, issued by Core to the signed-in operator and cached until expiry. */
export async function playerTokenFor(userId: string): Promise<string> {
  const cached = tokens.get(userId)
  if (cached !== undefined && Date.parse(cached.expiresAt) - Date.now() > REFRESH_MARGIN_MS) {
    return cached.token
  }
  const issued = await coreRequest<PlayerTokenResponse>('POST', '/v1/admin/player-tokens', {
    userId,
  })
  tokens.set(userId, issued)
  return issued.token
}

export function rememberSessionOwner(sessionId: string, userId: string): void {
  sessionOwners.set(sessionId, userId)
}

export async function playerTokenForSession(sessionId: string): Promise<string> {
  let owner = sessionOwners.get(sessionId)
  if (owner === undefined) {
    const { inspect } = await coreRequest<AdminSessionInspectResponse>(
      'GET',
      `/v1/admin/sessions/${sessionId}/inspect`,
    )
    owner = inspect.session.userId
    rememberSessionOwner(sessionId, owner)
  }
  return playerTokenFor(owner)
}

/** Calls a player route of `sessionId` as that session's owner. */
export async function sessionPlayerRequest<T>(
  sessionId: string,
  method: HttpMethod,
  path: string,
  body?: unknown,
): Promise<T> {
  return coreRequest<T>(method, path, body, await playerTokenForSession(sessionId))
}

import { PlayerTokenService } from '../../application/auth/player-token.service.js'

/** Secrets fixed by docker-compose.e2e.yml for the stack-e2e suite. */
export const STACK_SERVICE_KEY = 'e2e-stack-secret-0123456789abcdef0123'
const STACK_PLAYER_TOKEN_SECRET = 'e2e-player-token-secret-0123456789abcdef'

export const STACK_PLAYER_ID = 'stack_player'

const stackPlayerTokens = new PlayerTokenService({
  secret: STACK_PLAYER_TOKEN_SECRET,
  ttlSeconds: 3600,
  refreshWindowSeconds: 3600,
})

export function stackPlayerHeaders(userId: string = STACK_PLAYER_ID): { authorization: string } {
  return { authorization: `Bearer ${stackPlayerTokens.issue(userId).token}` }
}

/**
 * Headers valid on both tiers when `secret` is the stack service key (a player token plus the
 * service key); any other value yields credentials no tier accepts.
 */
export function stackCredentialHeaders(
  secret: string = STACK_SERVICE_KEY,
  userId: string = STACK_PLAYER_ID,
): Record<string, string> {
  if (secret === STACK_SERVICE_KEY) {
    return { ...stackPlayerHeaders(userId), 'x-admin-service-key': secret }
  }
  return { authorization: `Bearer ${secret}`, 'x-admin-service-key': secret }
}

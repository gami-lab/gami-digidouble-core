import { PlayerTokenService } from '../../application/auth/player-token.service.js'
import { TEST_CONFIG } from './test-config.js'

/** The player that route-test fixtures seed sessions for. */
export const TEST_PLAYER_ID = 'user_1'

const testPlayerTokens = new PlayerTokenService({
  secret: TEST_CONFIG.playerTokenSecret,
  ttlSeconds: TEST_CONFIG.playerTokenTtlSeconds,
  refreshWindowSeconds: TEST_CONFIG.playerTokenRefreshWindowSeconds,
})

export function playerToken(userId: string = TEST_PLAYER_ID): string {
  return testPlayerTokens.issue(userId).token
}

export function playerHeaders(userId: string = TEST_PLAYER_ID): { authorization: string } {
  return { authorization: `Bearer ${playerToken(userId)}` }
}

export function serviceKeyHeaders(): { 'x-admin-service-key': string } {
  return { 'x-admin-service-key': TEST_CONFIG.adminServiceKey ?? '' }
}

/**
 * Headers valid on both tiers when `secret` is the test service key (a player token for the
 * fixture player plus the service key); any other value yields credentials no tier accepts.
 */
export function credentialHeaders(
  secret: string = TEST_CONFIG.adminServiceKey ?? '',
  userId: string = TEST_PLAYER_ID,
): Record<string, string> {
  if (secret === TEST_CONFIG.adminServiceKey) {
    return { ...playerHeaders(userId), ...serviceKeyHeaders() }
  }
  return { authorization: `Bearer ${secret}`, 'x-admin-service-key': secret }
}

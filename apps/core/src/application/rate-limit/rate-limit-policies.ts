export const RATE_LIMIT_POLICY_NAMES = [
  'playerToken',
  'adminLogin',
  'sessionStart',
  'message',
  'voice',
  'audio',
  'mediaPlayback',
] as const

export type RateLimitPolicyName = (typeof RATE_LIMIT_POLICY_NAMES)[number]

export type RateLimitPolicy = { max: number; windowSeconds: number }

export type RateLimitPolicies = Record<RateLimitPolicyName, RateLimitPolicy>

/** Safe defaults; each is overridable with `RATE_LIMIT_<NAME>=<max>/<windowSeconds>`. */
export const DEFAULT_RATE_LIMIT_POLICIES: RateLimitPolicies = {
  playerToken: { max: 20, windowSeconds: 60 },
  adminLogin: { max: 10, windowSeconds: 300 },
  sessionStart: { max: 10, windowSeconds: 60 },
  message: { max: 30, windowSeconds: 60 },
  voice: { max: 20, windowSeconds: 60 },
  audio: { max: 60, windowSeconds: 60 },
  mediaPlayback: { max: 60, windowSeconds: 60 },
}

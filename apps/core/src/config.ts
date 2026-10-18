/**
 * Application configuration — loaded once at startup.
 * Fails fast on missing required environment variables.
 */

import {
  isTextToSpeechProviderName,
  TEXT_TO_SPEECH_PROVIDER_NAMES,
  type TextToSpeechProviderName,
} from '@gami/shared'
import { randomBytes } from 'node:crypto'
import { isPasswordHash } from './application/auth/password-hash.js'
import {
  DEFAULT_RATE_LIMIT_POLICIES,
  RATE_LIMIT_POLICY_NAMES,
  type RateLimitPolicies,
  type RateLimitPolicy,
} from './application/rate-limit/rate-limit-policies.js'
import {
  normalizeSpeechToTextLanguage,
  SPEECH_TO_TEXT_LIMITS,
  type SpeechToTextLimits,
} from './application/ports/ISpeechToTextAdapter.js'
import {
  TEXT_TO_SPEECH_LIMITS,
  type TextToSpeechLimits,
} from './application/ports/ITextToSpeechAdapter.js'

export interface Config {
  port: number
  host: string
  nodeEnv: string
  logLevel: string
  databaseUrl: string
  redisUrl: string
  /** Browser origins allowed to call player routes (no credentials); `*` allows any origin. */
  playerOrigins: string[]
  /** Proxy hops in front of Core, so rate limits key on the client IP rather than the proxy. */
  trustProxyHops: number
  rateLimits: RateLimitPolicies
  /** `scrypt:` hash of the single operator password; admin sign-in is disabled when absent. */
  adminPasswordHash: string | undefined
  /** Keys admin sessions in Redis so a store dump holds no usable cookie value. */
  adminSessionSecret: string
  adminSessionTtlSeconds: number
  /** Server-side credential for tools; never part of a browser bundle. */
  adminServiceKey: string | undefined
  /** Browser origins allowed to make credentialed admin requests (CORS and CSRF origin check). */
  adminOrigins: string[]
  /** Signs player tokens; tokens are the only source of a player's `userId`. */
  playerTokenSecret: string
  playerTokenTtlSeconds: number
  playerTokenRefreshWindowSeconds: number
  llmProvider: string
  embeddingProvider: string
  embeddingModel: string
  embeddingDimensions: number
  embeddingBatchSize: number
  openaiApiKey: string | undefined
  anthropicApiKey: string | undefined
  mistralApiKey: string | undefined
  xaiApiKey: string | undefined
  deepgramApiKey: string | undefined
  deepgramModel: string
  deepgramTimeoutMs: number
  deepgramDefaultLanguage: string | undefined
  speechToTextLimits: SpeechToTextLimits
  /** Default text-to-speech provider; scenarios/avatars may pick any provider with an API key. */
  ttsProvider: 'null' | TextToSpeechProviderName
  gradiumApiKey: string | undefined
  gradiumBaseUrl: string
  gradiumTimeoutMs: number
  textToSpeechLimits: TextToSpeechLimits
  langfusePublicKey: string | undefined
  langfuseSecretKey: string | undefined
  langfuseHost: string | undefined
  knowledgeSourceAllowedRoots: string[]
}

export const DEFAULT_EMBEDDING_PROVIDER = 'openai'
export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small'
// Use the model's native 1536 dimensions to preserve semantic resolution.
// A matching fresh schema and staged reindex are required before promotion.
export const DEFAULT_EMBEDDING_DIMENSIONS = 1536
export const DEFAULT_EMBEDDING_BATCH_SIZE = 100
export const DEFAULT_DEEPGRAM_MODEL = 'nova-3'
export const DEFAULT_DEEPGRAM_TIMEOUT_MS = 30_000
export const DEFAULT_DEEPGRAM_LANGUAGE = 'en'
export const DEFAULT_TTS_PROVIDER = 'gradium'
export const DEFAULT_GRADIUM_BASE_URL = 'https://api.gradium.ai/api'
export const DEFAULT_GRADIUM_TIMEOUT_MS = 30_000
export const DEFAULT_ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60
export const MIN_ADMIN_SECRET_LENGTH = 32
export const DEFAULT_PLAYER_TOKEN_TTL_SECONDS = 2 * 60 * 60
export const DEFAULT_PLAYER_TOKEN_REFRESH_WINDOW_SECONDS = 7 * 24 * 60 * 60

function requireEnv(key: string): string {
  const value = process.env[key]
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

export function loadConfig(): Config {
  return {
    port: parseInt(process.env['PORT'] ?? '3000', 10),
    host: process.env['HOST'] ?? '0.0.0.0',
    nodeEnv: process.env['NODE_ENV'] ?? 'development',
    logLevel: process.env['LOG_LEVEL'] ?? 'info',
    databaseUrl: requireEnv('DATABASE_URL'),
    redisUrl: requireEnv('REDIS_URL'),
    playerOrigins: parseList(process.env['PLAYER_ORIGINS'] ?? '*'),
    trustProxyHops: parseTrustProxyHops(process.env['TRUST_PROXY_HOPS']),
    rateLimits: loadRateLimitPolicies(),
    ...loadAdminAuthConfig(process.env['NODE_ENV'] === 'production'),
    ...loadPlayerTokenConfig(process.env['NODE_ENV'] === 'production'),
    llmProvider: process.env['LLM_PROVIDER'] ?? 'null',
    embeddingProvider: process.env['EMBEDDING_PROVIDER'] ?? DEFAULT_EMBEDDING_PROVIDER,
    embeddingModel: process.env['EMBEDDING_MODEL'] ?? DEFAULT_EMBEDDING_MODEL,
    embeddingDimensions: parsePositiveInteger(
      'EMBEDDING_DIMENSIONS',
      process.env['EMBEDDING_DIMENSIONS'],
      DEFAULT_EMBEDDING_DIMENSIONS,
    ),
    embeddingBatchSize: parsePositiveInteger(
      'EMBEDDING_BATCH_SIZE',
      process.env['EMBEDDING_BATCH_SIZE'],
      DEFAULT_EMBEDDING_BATCH_SIZE,
    ),
    openaiApiKey: process.env['OPENAI_API_KEY'],
    anthropicApiKey: process.env['ANTHROPIC_API_KEY'],
    mistralApiKey: process.env['MISTRAL_API_KEY'],
    xaiApiKey: process.env['XAI_API_KEY'],
    deepgramApiKey: process.env['DEEPGRAM_API_KEY'],
    deepgramModel: parseBoundedString(
      'DEEPGRAM_MODEL',
      process.env['DEEPGRAM_MODEL'],
      DEFAULT_DEEPGRAM_MODEL,
      1,
      100,
    ),
    deepgramTimeoutMs: parseBoundedPositiveInteger(
      'DEEPGRAM_TIMEOUT_MS',
      process.env['DEEPGRAM_TIMEOUT_MS'],
      DEFAULT_DEEPGRAM_TIMEOUT_MS,
      100,
      120_000,
    ),
    deepgramDefaultLanguage: parseLanguage(
      'DEEPGRAM_DEFAULT_LANGUAGE',
      process.env['DEEPGRAM_DEFAULT_LANGUAGE'],
      DEFAULT_DEEPGRAM_LANGUAGE,
    ),
    speechToTextLimits: SPEECH_TO_TEXT_LIMITS,
    ttsProvider: parseTtsProvider(process.env['TTS_PROVIDER']),
    gradiumApiKey: process.env['GRADIUM_API_KEY'],
    gradiumBaseUrl: parseUrl(
      'GRADIUM_BASE_URL',
      process.env['GRADIUM_BASE_URL'],
      DEFAULT_GRADIUM_BASE_URL,
    ).replace(/\/+$/, ''),
    gradiumTimeoutMs: parseBoundedPositiveInteger(
      'GRADIUM_TIMEOUT_MS',
      process.env['GRADIUM_TIMEOUT_MS'],
      DEFAULT_GRADIUM_TIMEOUT_MS,
      100,
      120_000,
    ),
    textToSpeechLimits: {
      ...TEXT_TO_SPEECH_LIMITS,
      maxOutputBytes: parseBoundedPositiveInteger(
        'TTS_MAX_OUTPUT_BYTES',
        process.env['TTS_MAX_OUTPUT_BYTES'],
        TEXT_TO_SPEECH_LIMITS.maxOutputBytes,
        1,
        50_000_000,
      ),
    },
    langfusePublicKey: process.env['LANGFUSE_PUBLIC_KEY'],
    langfuseSecretKey: process.env['LANGFUSE_SECRET_KEY'],
    langfuseHost: process.env['LANGFUSE_BASE_URL'],
    knowledgeSourceAllowedRoots: parseList(process.env['KNOWLEDGE_SOURCE_ALLOWED_ROOTS']),
  }
}

type AdminAuthConfig = Pick<
  Config,
  | 'adminPasswordHash'
  | 'adminSessionSecret'
  | 'adminSessionTtlSeconds'
  | 'adminServiceKey'
  | 'adminOrigins'
>

/** Production refuses to start without every admin credential; development may omit them. */
function loadAdminAuthConfig(isProduction: boolean): AdminAuthConfig {
  const passwordHash = optionalEnv('ADMIN_PASSWORD_HASH')
  const sessionSecret = optionalEnv('ADMIN_SESSION_SECRET')
  const serviceKey = optionalEnv('ADMIN_SERVICE_KEY')

  if (isProduction) {
    for (const [key, value] of [
      ['ADMIN_PASSWORD_HASH', passwordHash],
      ['ADMIN_SESSION_SECRET', sessionSecret],
      ['ADMIN_SERVICE_KEY', serviceKey],
    ] as const) {
      if (value === undefined) throw new Error(`Missing required environment variable: ${key}`)
    }
  }
  if (passwordHash !== undefined && !isPasswordHash(passwordHash)) {
    throw new Error('Invalid ADMIN_PASSWORD_HASH: expected the output of hash-admin-password.')
  }
  requireSecretLength('ADMIN_SESSION_SECRET', sessionSecret)
  requireSecretLength('ADMIN_SERVICE_KEY', serviceKey)

  return {
    adminPasswordHash: passwordHash,
    adminSessionSecret: sessionSecret ?? randomBytes(MIN_ADMIN_SECRET_LENGTH).toString('base64url'),
    adminSessionTtlSeconds: parseBoundedPositiveInteger(
      'ADMIN_SESSION_TTL_SECONDS',
      process.env['ADMIN_SESSION_TTL_SECONDS'],
      DEFAULT_ADMIN_SESSION_TTL_SECONDS,
      60,
      7 * 24 * 60 * 60,
    ),
    adminServiceKey: serviceKey,
    adminOrigins: parseList(process.env['ADMIN_ORIGINS']),
  }
}

function loadPlayerTokenConfig(
  isProduction: boolean,
): Pick<Config, 'playerTokenSecret' | 'playerTokenTtlSeconds' | 'playerTokenRefreshWindowSeconds'> {
  const secret = optionalEnv('PLAYER_TOKEN_SECRET')
  if (isProduction && secret === undefined) {
    throw new Error('Missing required environment variable: PLAYER_TOKEN_SECRET')
  }
  requireSecretLength('PLAYER_TOKEN_SECRET', secret)

  return {
    playerTokenSecret: secret ?? randomBytes(MIN_ADMIN_SECRET_LENGTH).toString('base64url'),
    playerTokenTtlSeconds: parseBoundedPositiveInteger(
      'PLAYER_TOKEN_TTL_SECONDS',
      process.env['PLAYER_TOKEN_TTL_SECONDS'],
      DEFAULT_PLAYER_TOKEN_TTL_SECONDS,
      60,
      24 * 60 * 60,
    ),
    playerTokenRefreshWindowSeconds: parseBoundedPositiveInteger(
      'PLAYER_TOKEN_REFRESH_WINDOW_SECONDS',
      process.env['PLAYER_TOKEN_REFRESH_WINDOW_SECONDS'],
      DEFAULT_PLAYER_TOKEN_REFRESH_WINDOW_SECONDS,
      60,
      30 * 24 * 60 * 60,
    ),
  }
}

function loadRateLimitPolicies(): RateLimitPolicies {
  const policies = { ...DEFAULT_RATE_LIMIT_POLICIES }
  for (const name of RATE_LIMIT_POLICY_NAMES) {
    const key = `RATE_LIMIT_${name.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`
    const value = optionalEnv(key)
    if (value !== undefined) policies[name] = parseRateLimitPolicy(key, value)
  }
  return policies
}

function parseRateLimitPolicy(key: string, value: string): RateLimitPolicy {
  const [max, windowSeconds, ...rest] = value.split('/').map(Number)
  if (
    rest.length > 0 ||
    max === undefined ||
    windowSeconds === undefined ||
    !Number.isInteger(max) ||
    !Number.isInteger(windowSeconds) ||
    max < 1 ||
    windowSeconds < 1
  ) {
    throw new Error(`Invalid ${key}: expected <max>/<windowSeconds>, e.g. 30/60.`)
  }
  return { max, windowSeconds }
}

function parseTrustProxyHops(value: string | undefined): number {
  const hops = Number(value === undefined || value.trim() === '' ? 0 : value)
  if (!Number.isInteger(hops) || hops < 0 || hops > 10) {
    throw new Error('Invalid TRUST_PROXY_HOPS: expected an integer from 0 to 10.')
  }
  return hops
}

function optionalEnv(key: string): string | undefined {
  const value = process.env[key]?.trim()
  return value === undefined || value.length === 0 ? undefined : value
}

function requireSecretLength(key: string, value: string | undefined): void {
  if (value !== undefined && value.length < MIN_ADMIN_SECRET_LENGTH) {
    throw new Error(
      `Invalid ${key}: expected at least ${String(MIN_ADMIN_SECRET_LENGTH)} characters.`,
    )
  }
}

function parsePositiveInteger(key: string, value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${key}: expected a positive integer.`)
  }
  return parsed
}

function parseBoundedPositiveInteger(
  key: string,
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = parsePositiveInteger(
    key,
    value === undefined || value.trim().length === 0 ? undefined : value,
    fallback,
  )
  if (parsed < minimum || parsed > maximum) {
    throw new Error(
      `Invalid ${key}: expected a value from ${String(minimum)} to ${String(maximum)}.`,
    )
  }
  return parsed
}

function parseBoundedString(
  key: string,
  value: string | undefined,
  fallback: string,
  minimumCharacters: number,
  maximumCharacters: number,
): string {
  const normalized = value === undefined || value.trim().length === 0 ? fallback : value.trim()
  if (normalized.length < minimumCharacters || normalized.length > maximumCharacters) {
    throw new Error(
      `Invalid ${key}: expected between ${String(minimumCharacters)} and ${String(maximumCharacters)} characters.`,
    )
  }
  return normalized
}

function parseLanguage(key: string, value: string | undefined, fallback: string): string {
  const normalized = normalizeSpeechToTextLanguage(
    value === undefined || value.trim().length === 0 ? fallback : value,
  )
  if (normalized === undefined || normalized === null) {
    throw new Error(`Invalid ${key}: expected a BCP-47 language tag.`)
  }
  return normalized
}

function parseTtsProvider(value: string | undefined): 'null' | TextToSpeechProviderName {
  const normalized = value === undefined || value.trim().length === 0 ? DEFAULT_TTS_PROVIDER : value
  if (normalized !== 'null' && !isTextToSpeechProviderName(normalized)) {
    throw new Error(
      `Invalid TTS_PROVIDER: expected null or one of ${TEXT_TO_SPEECH_PROVIDER_NAMES.join(', ')}.`,
    )
  }
  return normalized
}

function parseUrl(key: string, value: string | undefined, fallback: string): string {
  const normalized = value === undefined || value.trim().length === 0 ? fallback : value.trim()
  try {
    const url = new URL(normalized)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error()
  } catch {
    throw new Error(`Invalid ${key}: expected an HTTP(S) URL.`)
  }
  return normalized
}

function parseList(value: string | undefined): string[] {
  if (value === undefined || value.trim().length === 0) return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

/**
 * Application configuration — loaded once at startup.
 * Fails fast on missing required environment variables.
 */

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
  apiKeySecret: string
  corsOrigin: string
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
  ttsProvider: 'null' | 'gradium'
  gradiumApiKey: string | undefined
  gradiumEndpoint: string
  gradiumTimeoutMs: number
  gradiumVoiceMap: Readonly<Record<string, string>>
  textToSpeechLimits: TextToSpeechLimits
  langfusePublicKey: string | undefined
  langfuseSecretKey: string | undefined
  langfuseHost: string | undefined
  knowledgeSourceAllowedRoots: string[]
}

export const DEFAULT_EMBEDDING_PROVIDER = 'openai'
export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small'
// Keep the first production profile compatible with the current VECTOR(16) schema.
// The next persistence slice can promote a larger profile atomically.
export const DEFAULT_EMBEDDING_DIMENSIONS = 16
export const DEFAULT_EMBEDDING_BATCH_SIZE = 100
export const DEFAULT_DEEPGRAM_MODEL = 'nova-3'
export const DEFAULT_DEEPGRAM_TIMEOUT_MS = 30_000
export const DEFAULT_DEEPGRAM_LANGUAGE = 'en'
export const DEFAULT_TTS_PROVIDER = 'null'
export const DEFAULT_GRADIUM_ENDPOINT = 'https://api.gradium.ai/api/post/speech/tts'
export const DEFAULT_GRADIUM_TIMEOUT_MS = 30_000

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
    apiKeySecret: requireEnv('API_KEY_SECRET'),
    corsOrigin: process.env['CORS_ORIGIN'] ?? '*',
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
    gradiumEndpoint: parseUrl(
      'GRADIUM_ENDPOINT',
      process.env['GRADIUM_ENDPOINT'],
      DEFAULT_GRADIUM_ENDPOINT,
    ),
    gradiumTimeoutMs: parseBoundedPositiveInteger(
      'GRADIUM_TIMEOUT_MS',
      process.env['GRADIUM_TIMEOUT_MS'],
      DEFAULT_GRADIUM_TIMEOUT_MS,
      100,
      120_000,
    ),
    gradiumVoiceMap: parseVoiceMap(process.env['GRADIUM_VOICE_MAP']),
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
    knowledgeSourceAllowedRoots: parseAllowedRoots(process.env['KNOWLEDGE_SOURCE_ALLOWED_ROOTS']),
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

function parseTtsProvider(value: string | undefined): 'null' | 'gradium' {
  const normalized = value === undefined || value.trim().length === 0 ? DEFAULT_TTS_PROVIDER : value
  if (normalized !== 'null' && normalized !== 'gradium') {
    throw new Error('Invalid TTS_PROVIDER: expected null or gradium.')
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

// eslint-disable-next-line complexity
function parseVoiceMap(value: string | undefined): Readonly<Record<string, string>> {
  if (value === undefined || value.trim().length === 0) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error('Invalid GRADIUM_VOICE_MAP: expected a JSON object.')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Invalid GRADIUM_VOICE_MAP: expected a JSON object.')
  }
  const map: Record<string, string> = {}
  for (const [logicalKey, providerVoiceId] of Object.entries(parsed)) {
    if (
      logicalKey.trim().length === 0 ||
      typeof providerVoiceId !== 'string' ||
      providerVoiceId.trim().length === 0
    ) {
      throw new Error('Invalid GRADIUM_VOICE_MAP: keys and values must be non-empty strings.')
    }
    map[logicalKey] = providerVoiceId
  }
  return map
}

function parseAllowedRoots(value: string | undefined): string[] {
  if (value === undefined || value.trim().length === 0) return []
  return value
    .split(',')
    .map((root) => root.trim())
    .filter((root) => root.length > 0)
}

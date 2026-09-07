/**
 * Application configuration — loaded once at startup.
 * Fails fast on missing required environment variables.
 */

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

function parseAllowedRoots(value: string | undefined): string[] {
  if (value === undefined || value.trim().length === 0) return []
  return value
    .split(',')
    .map((root) => root.trim())
    .filter((root) => root.length > 0)
}

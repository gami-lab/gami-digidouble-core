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
  llmProvider: string
  openaiApiKey: string | undefined
  anthropicApiKey: string | undefined
  mistralApiKey: string | undefined
}

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
    llmProvider: process.env['LLM_PROVIDER'] ?? 'null',
    openaiApiKey: process.env['OPENAI_API_KEY'],
    anthropicApiKey: process.env['ANTHROPIC_API_KEY'],
    mistralApiKey: process.env['MISTRAL_API_KEY'],
  }
}

import type { Config } from '../../config.js'

/**
 * Canonical test config fixture for API route unit tests.
 *
 * Centralised here so adding a new field to Config only requires
 * updating this one file instead of every test file individually.
 */
export const TEST_CONFIG: Config = {
  port: 3000,
  host: '0.0.0.0',
  nodeEnv: 'test',
  logLevel: 'silent',
  databaseUrl: 'postgresql://test',
  redisUrl: 'redis://test',
  apiKeySecret: 'test-secret',
  corsOrigin: '*',
  llmProvider: 'null',
  openaiApiKey: undefined,
  anthropicApiKey: undefined,
  mistralApiKey: undefined,
  xaiApiKey: undefined,
  langfusePublicKey: undefined,
  langfuseSecretKey: undefined,
  langfuseHost: undefined,
}

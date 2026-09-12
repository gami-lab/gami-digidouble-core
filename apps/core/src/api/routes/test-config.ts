import type { Config } from '../../config.js'
import { SPEECH_TO_TEXT_LIMITS } from '../../application/ports/ISpeechToTextAdapter.js'

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
  embeddingProvider: 'openai',
  embeddingModel: 'text-embedding-3-small',
  embeddingDimensions: 16,
  embeddingBatchSize: 100,
  openaiApiKey: undefined,
  anthropicApiKey: undefined,
  mistralApiKey: undefined,
  xaiApiKey: undefined,
  deepgramApiKey: undefined,
  deepgramModel: 'nova-3',
  deepgramTimeoutMs: 30_000,
  deepgramDefaultLanguage: 'en',
  speechToTextLimits: SPEECH_TO_TEXT_LIMITS,
  ttsProvider: 'null',
  gradiumApiKey: undefined,
  gradiumEndpoint: 'https://api.gradium.ai/api/post/speech/tts',
  gradiumTimeoutMs: 30_000,
  gradiumVoiceMap: {},
  textToSpeechLimits: {
    maxTextCharacters: 10_000,
    maxOutputBytes: 10_000_000,
  },
  langfusePublicKey: undefined,
  langfuseSecretKey: undefined,
  langfuseHost: undefined,
  knowledgeSourceAllowedRoots: [],
}

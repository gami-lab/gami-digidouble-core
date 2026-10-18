import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_GRADIUM_BASE_URL,
  DEFAULT_GRADIUM_TIMEOUT_MS,
  DEFAULT_DEEPGRAM_LANGUAGE,
  DEFAULT_DEEPGRAM_MODEL,
  DEFAULT_DEEPGRAM_TIMEOUT_MS,
  DEFAULT_TTS_PROVIDER,
  loadConfig,
} from './config.js'

describe('loadConfig Deepgram settings', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://test')
    vi.stubEnv('REDIS_URL', 'redis://test')
    vi.stubEnv('API_KEY_SECRET', 'test-secret')
    vi.stubEnv('DEEPGRAM_API_KEY', '')
    vi.stubEnv('DEEPGRAM_MODEL', '')
    vi.stubEnv('DEEPGRAM_TIMEOUT_MS', '')
    vi.stubEnv('DEEPGRAM_DEFAULT_LANGUAGE', '')
    vi.stubEnv('TTS_PROVIDER', '')
    vi.stubEnv('GRADIUM_API_KEY', '')
    vi.stubEnv('GRADIUM_BASE_URL', '')
    vi.stubEnv('GRADIUM_TIMEOUT_MS', '')
    vi.stubEnv('TTS_MAX_OUTPUT_BYTES', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses bounded defaults while keeping the optional provider credential absent', () => {
    const config = loadConfig()

    expect(config.deepgramApiKey).toBe('')
    expect(config.deepgramModel).toBe(DEFAULT_DEEPGRAM_MODEL)
    expect(config.deepgramTimeoutMs).toBe(DEFAULT_DEEPGRAM_TIMEOUT_MS)
    expect(config.deepgramDefaultLanguage).toBe(DEFAULT_DEEPGRAM_LANGUAGE)
    expect(config.speechToTextLimits.maxAudioBytes).toBe(10_000_000)
    expect(config.ttsProvider).toBe(DEFAULT_TTS_PROVIDER)
    expect(config.gradiumApiKey).toBe('')
    expect(config.gradiumBaseUrl).toBe(DEFAULT_GRADIUM_BASE_URL)
    expect(config.gradiumTimeoutMs).toBe(DEFAULT_GRADIUM_TIMEOUT_MS)
    expect(config.textToSpeechLimits.maxOutputBytes).toBe(10_000_000)
  })

  it('normalizes configured model, timeout, language, and credential values', () => {
    vi.stubEnv('DEEPGRAM_API_KEY', ' dg-secret ')
    vi.stubEnv('DEEPGRAM_MODEL', ' nova-3-custom ')
    vi.stubEnv('DEEPGRAM_TIMEOUT_MS', '45000')
    vi.stubEnv('DEEPGRAM_DEFAULT_LANGUAGE', 'fr-fr')

    const config = loadConfig()

    expect(config.deepgramApiKey).toBe(' dg-secret ')
    expect(config.deepgramModel).toBe('nova-3-custom')
    expect(config.deepgramTimeoutMs).toBe(45_000)
    expect(config.deepgramDefaultLanguage).toBe('fr-FR')
  })

  it.each([
    ['DEEPGRAM_TIMEOUT_MS', '99'],
    ['DEEPGRAM_TIMEOUT_MS', '120001'],
    ['DEEPGRAM_DEFAULT_LANGUAGE', 'fr_FR'],
    ['DEEPGRAM_MODEL', 'x'.repeat(101)],
  ] as const)('rejects invalid %s configuration', (key, value) => {
    vi.stubEnv(key, value)

    expect(() => loadConfig()).toThrow(`Invalid ${key}`)
  })

  it('parses private Gradium settings without changing the provider-neutral contract', () => {
    vi.stubEnv('TTS_PROVIDER', 'gradium')
    vi.stubEnv('GRADIUM_API_KEY', ' gradium-secret ')
    vi.stubEnv('GRADIUM_BASE_URL', 'http://localhost:4010/api/')
    vi.stubEnv('GRADIUM_TIMEOUT_MS', '45000')
    vi.stubEnv('TTS_MAX_OUTPUT_BYTES', '12345')

    const config = loadConfig()

    expect(config.ttsProvider).toBe('gradium')
    expect(config.gradiumApiKey).toBe(' gradium-secret ')
    expect(config.gradiumBaseUrl).toBe('http://localhost:4010/api')
    expect(config.gradiumTimeoutMs).toBe(45_000)
    expect(config.textToSpeechLimits.maxOutputBytes).toBe(12_345)
  })

  it.each([
    ['TTS_PROVIDER', 'other'],
    ['GRADIUM_BASE_URL', 'file:///tmp/tts'],
    ['GRADIUM_TIMEOUT_MS', '99'],
    ['TTS_MAX_OUTPUT_BYTES', '0'],
  ] as const)('rejects invalid %s configuration', (key, value) => {
    vi.stubEnv(key, value)

    expect(() => loadConfig()).toThrow(`Invalid ${key}`)
  })
})

describe('loadConfig admin authentication settings', () => {
  const validHash = `scrypt:${Buffer.alloc(16, 1).toString('base64url')}:${Buffer.alloc(64, 2).toString('base64url')}`
  const longSecret = 'x'.repeat(32)

  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://test')
    vi.stubEnv('REDIS_URL', 'redis://test')
    vi.stubEnv('API_KEY_SECRET', 'test-secret')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ADMIN_PASSWORD_HASH', validHash)
    vi.stubEnv('ADMIN_SESSION_SECRET', longSecret)
    vi.stubEnv('ADMIN_SERVICE_KEY', longSecret)
    vi.stubEnv('ADMIN_ORIGINS', 'https://app.example.com, https://console.example.com')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('loads every admin credential and origin in production', () => {
    const config = loadConfig()

    expect(config.adminPasswordHash).toBe(validHash)
    expect(config.adminServiceKey).toBe(longSecret)
    expect(config.adminSessionTtlSeconds).toBe(8 * 60 * 60)
    expect(config.adminOrigins).toEqual(['https://app.example.com', 'https://console.example.com'])
  })

  it.each(['ADMIN_PASSWORD_HASH', 'ADMIN_SESSION_SECRET', 'ADMIN_SERVICE_KEY'])(
    'refuses to start in production without %s',
    (key) => {
      vi.stubEnv(key, '')

      expect(() => loadConfig()).toThrow(`Missing required environment variable: ${key}`)
    },
  )

  it.each(['ADMIN_SESSION_SECRET', 'ADMIN_SERVICE_KEY'])('rejects a short %s', (key) => {
    vi.stubEnv(key, 'too-short')

    expect(() => loadConfig()).toThrow(`Invalid ${key}`)
  })

  it('rejects a password hash that is not a scrypt hash', () => {
    vi.stubEnv('ADMIN_PASSWORD_HASH', 'plain-password')

    expect(() => loadConfig()).toThrow('Invalid ADMIN_PASSWORD_HASH')
  })

  it('lets development run without admin credentials', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('ADMIN_PASSWORD_HASH', '')
    vi.stubEnv('ADMIN_SESSION_SECRET', '')
    vi.stubEnv('ADMIN_SERVICE_KEY', '')

    const config = loadConfig()

    expect(config.adminPasswordHash).toBeUndefined()
    expect(config.adminServiceKey).toBeUndefined()
    expect(config.adminSessionSecret.length).toBeGreaterThanOrEqual(32)
  })
})

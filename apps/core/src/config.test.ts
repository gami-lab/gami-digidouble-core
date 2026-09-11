import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_DEEPGRAM_LANGUAGE,
  DEFAULT_DEEPGRAM_MODEL,
  DEFAULT_DEEPGRAM_TIMEOUT_MS,
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
})

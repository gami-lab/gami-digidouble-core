import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_GRADIUM_ENDPOINT,
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
    vi.stubEnv('GRADIUM_ENDPOINT', '')
    vi.stubEnv('GRADIUM_TIMEOUT_MS', '')
    vi.stubEnv('GRADIUM_VOICE_MAP', '')
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
    expect(config.gradiumEndpoint).toBe(DEFAULT_GRADIUM_ENDPOINT)
    expect(config.gradiumTimeoutMs).toBe(DEFAULT_GRADIUM_TIMEOUT_MS)
    expect(config.gradiumVoiceMap).toEqual({})
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
    vi.stubEnv('GRADIUM_ENDPOINT', 'http://localhost:4010/tts')
    vi.stubEnv('GRADIUM_TIMEOUT_MS', '45000')
    vi.stubEnv('GRADIUM_VOICE_MAP', '{"avatar-default":"provider-voice-1"}')
    vi.stubEnv('TTS_MAX_OUTPUT_BYTES', '12345')

    const config = loadConfig()

    expect(config.ttsProvider).toBe('gradium')
    expect(config.gradiumApiKey).toBe(' gradium-secret ')
    expect(config.gradiumEndpoint).toBe('http://localhost:4010/tts')
    expect(config.gradiumTimeoutMs).toBe(45_000)
    expect(config.gradiumVoiceMap).toEqual({ 'avatar-default': 'provider-voice-1' })
    expect(config.textToSpeechLimits.maxOutputBytes).toBe(12_345)
  })

  it.each([
    ['TTS_PROVIDER', 'other'],
    ['GRADIUM_ENDPOINT', 'file:///tmp/tts'],
    ['GRADIUM_TIMEOUT_MS', '99'],
    ['TTS_MAX_OUTPUT_BYTES', '0'],
    ['GRADIUM_VOICE_MAP', '[]'],
    ['GRADIUM_VOICE_MAP', '{"avatar-default":1}'],
  ] as const)('rejects invalid %s configuration', (key, value) => {
    vi.stubEnv(key, value)

    expect(() => loadConfig()).toThrow(`Invalid ${key}`)
  })
})

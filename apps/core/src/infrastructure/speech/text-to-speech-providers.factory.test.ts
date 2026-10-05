import { describe, expect, it } from 'vitest'
import { TEXT_TO_SPEECH_LIMITS } from '../../application/ports/ITextToSpeechAdapter.js'
import { NullObservabilityAdapter } from '../observability/null.adapter.js'
import { GradiumTextToSpeechAdapter } from './gradium-text-to-speech.adapter.js'
import { OpenAiTextToSpeechAdapter } from './openai-text-to-speech.adapter.js'
import { createTextToSpeechProviders } from './text-to-speech-providers.factory.js'

const gradium = { baseUrl: 'https://gradium.test/api', timeoutMs: 30_000 }

function create(
  overrides: {
    defaultProvider?: 'gradium' | 'openai' | null
    gradiumApiKey?: string
    openaiApiKey?: string
  } = {},
) {
  return createTextToSpeechProviders(
    {
      defaultProvider:
        overrides.defaultProvider === undefined ? 'gradium' : overrides.defaultProvider,
      gradium: {
        ...gradium,
        ...(overrides.gradiumApiKey === undefined ? {} : { apiKey: overrides.gradiumApiKey }),
      },
      openai: overrides.openaiApiKey === undefined ? {} : { apiKey: overrides.openaiApiKey },
      limits: TEXT_TO_SPEECH_LIMITS,
    },
    new NullObservabilityAdapter(),
  )
}

describe('createTextToSpeechProviders', () => {
  it('registers no provider without credentials, so there is no default either', () => {
    const providers = create({ gradiumApiKey: '  ', openaiApiKey: '' })

    expect(providers.available).toEqual([])
    expect(providers.defaultProvider).toBeNull()
    expect(providers.get('gradium')).toBeUndefined()
  })

  it('registers each provider whose API key is present', () => {
    const providers = create({ gradiumApiKey: 'gradium-secret', openaiApiKey: 'openai-secret' })

    expect(providers.available).toEqual(['gradium', 'openai'])
    expect(providers.defaultProvider).toBe('gradium')
    expect(providers.get('gradium')).toBeInstanceOf(GradiumTextToSpeechAdapter)
    expect(providers.get('openai')).toBeInstanceOf(OpenAiTextToSpeechAdapter)
  })

  it('uses OpenAI as the default when configured, and drops a default without a key', () => {
    expect(create({ defaultProvider: 'openai', openaiApiKey: 'k' }).defaultProvider).toBe('openai')
    expect(create({ defaultProvider: 'gradium', openaiApiKey: 'k' }).defaultProvider).toBeNull()
  })

  it('keeps providers selectable per scenario when there is no default provider', () => {
    const providers = create({ defaultProvider: null, gradiumApiKey: 'k' })

    expect(providers.available).toEqual(['gradium'])
    expect(providers.defaultProvider).toBeNull()
  })
})

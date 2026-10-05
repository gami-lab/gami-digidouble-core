import { describe, expect, it } from 'vitest'
import { DomainError } from '../errors.js'
import {
  assertVoiceConfigurationIsNotEmbedded,
  normalizeVoiceConfiguration,
  selectVoice,
} from './voice-configuration.js'
import type { TextToSpeechProviderName } from '@gami/shared'

describe('voice configuration', () => {
  it('normalizes a provider voice selection', () => {
    expect(
      normalizeVoiceConfiguration(
        { provider: 'gradium', voiceId: '  voice_1  ' },
        { allowClear: false },
      ),
    ).toEqual({ provider: 'gradium', voiceId: 'voice_1' })
    expect(normalizeVoiceConfiguration({ provider: 'gradium' }, { allowClear: false })).toEqual({
      provider: 'gradium',
    })
  })

  it('rejects unknown providers, empty ids, and extra fields', () => {
    for (const value of [
      { provider: 'acme', voiceId: 'voice_1' },
      { provider: 'gradium', voiceId: '' },
      { provider: 'gradium', voiceId: 'voice_1', apiKey: 'secret' },
    ]) {
      expect(() => normalizeVoiceConfiguration(value, { allowClear: false })).toThrow(DomainError)
    }
  })

  it('allows null only for updates', () => {
    expect(normalizeVoiceConfiguration(null, { allowClear: true })).toBeNull()
    expect(() => normalizeVoiceConfiguration(null, { allowClear: false })).toThrow(DomainError)
  })

  it('selects the Avatar voice over the Scenario voice, else the default provider', () => {
    const scenarioVoice = { provider: 'gradium', voiceId: 'scenario-voice' } as const
    const avatarVoice = { provider: 'gradium', voiceId: 'avatar-voice' } as const

    expect(selectVoice(scenarioVoice, avatarVoice, ['gradium'], 'gradium')).toEqual(avatarVoice)
    expect(selectVoice(scenarioVoice, undefined, ['gradium'], 'gradium')).toEqual(scenarioVoice)
    expect(selectVoice(undefined, undefined, ['gradium'], 'gradium')).toEqual({
      provider: 'gradium',
    })
  })

  it('lets a scenario pick a provider when there is no default provider', () => {
    expect(selectVoice({ provider: 'gradium' }, undefined, ['gradium'], null)).toEqual({
      provider: 'gradium',
    })
    expect(selectVoice(undefined, undefined, ['gradium'], null)).toBeUndefined()
  })

  it('keeps the scenario voice when the avatar only pins the same provider', () => {
    expect(
      selectVoice(
        { provider: 'gradium', voiceId: 'scenario-voice' },
        { provider: 'gradium' },
        ['gradium'],
        'gradium',
      ),
    ).toEqual({ provider: 'gradium', voiceId: 'scenario-voice' })
  })

  it('skips selections for providers without credentials', () => {
    const otherProvider = 'other' as TextToSpeechProviderName
    const avatarVoice = { provider: otherProvider, voiceId: 'other-voice' }
    const scenarioVoice = { provider: 'gradium', voiceId: 'scenario-voice' } as const

    expect(selectVoice(scenarioVoice, avatarVoice, ['gradium'], 'gradium')).toEqual(scenarioVoice)
    expect(selectVoice(undefined, avatarVoice, ['gradium'], 'gradium')).toEqual({
      provider: 'gradium',
    })
    expect(selectVoice(scenarioVoice, undefined, [], null)).toBeUndefined()
  })

  it('requires voice configuration to be a top-level mutation field', () => {
    expect(() => {
      assertVoiceConfigurationIsNotEmbedded({
        voiceConfig: { provider: 'gradium', voiceId: 'nested' },
      })
    }).toThrow(DomainError)
    expect(() => {
      assertVoiceConfigurationIsNotEmbedded({ unrelatedConfig: 'public' })
    }).not.toThrow()
  })
})

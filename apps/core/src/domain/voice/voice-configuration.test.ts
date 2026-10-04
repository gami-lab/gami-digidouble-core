import { describe, expect, it } from 'vitest'
import { DomainError } from '../errors.js'
import {
  assertVoiceConfigurationIsNotEmbedded,
  normalizeVoiceConfiguration,
  selectVoiceId,
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

  it('selects the Avatar voice over the Scenario voice', () => {
    const scenarioVoice = { provider: 'gradium', voiceId: 'scenario-voice' } as const
    const avatarVoice = { provider: 'gradium', voiceId: 'avatar-voice' } as const

    expect(selectVoiceId(scenarioVoice, avatarVoice, 'gradium')).toBe('avatar-voice')
    expect(selectVoiceId(scenarioVoice, undefined, 'gradium')).toBe('scenario-voice')
    expect(selectVoiceId(undefined, undefined, 'gradium')).toBeUndefined()
  })

  it('skips selections saved for another provider', () => {
    const otherProvider = 'other' as TextToSpeechProviderName
    const avatarVoice = { provider: otherProvider, voiceId: 'other-voice' }
    const scenarioVoice = { provider: 'gradium', voiceId: 'scenario-voice' } as const

    expect(selectVoiceId(scenarioVoice, avatarVoice, 'gradium')).toBe('scenario-voice')
    expect(selectVoiceId(undefined, avatarVoice, 'gradium')).toBeUndefined()
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

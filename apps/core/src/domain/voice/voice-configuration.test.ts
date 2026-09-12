import { describe, expect, it } from 'vitest'
import { DomainError } from '../errors.js'
import {
  assertVoiceConfigurationIsNotEmbedded,
  normalizeVoiceConfiguration,
  resolveVoiceConfiguration,
} from './voice-configuration.js'

describe('voice configuration', () => {
  it('normalizes a provider-neutral voice configuration', () => {
    expect(
      normalizeVoiceConfiguration(
        { voiceKey: '  guide  ', language: ' en-US ' },
        { allowClear: false },
      ),
    ).toEqual({ voiceKey: 'guide', language: 'en-US' })
  })

  it('rejects invalid or provider-specific fields', () => {
    expect(() =>
      normalizeVoiceConfiguration(
        { voiceKey: '', providerVoiceId: 'secret' },
        { allowClear: false },
      ),
    ).toThrow(DomainError)
  })

  it('allows null only for updates', () => {
    expect(normalizeVoiceConfiguration(null, { allowClear: true })).toBeNull()
    expect(() => normalizeVoiceConfiguration(null, { allowClear: false })).toThrow(DomainError)
  })

  it('resolves Avatar voice over the Scenario default', () => {
    const scenarioVoice = { voiceKey: 'scenario-default' }
    const avatarVoice = { voiceKey: 'avatar-override' }

    expect(resolveVoiceConfiguration(scenarioVoice, avatarVoice)).toEqual(avatarVoice)
    expect(resolveVoiceConfiguration(scenarioVoice, undefined)).toEqual(scenarioVoice)
    expect(resolveVoiceConfiguration(undefined, undefined)).toBeUndefined()
  })

  it('requires voice configuration to be a top-level mutation field', () => {
    expect(() => {
      assertVoiceConfigurationIsNotEmbedded({ voiceConfig: { voiceKey: 'nested' } })
    }).toThrow(DomainError)
    expect(() => {
      assertVoiceConfigurationIsNotEmbedded({ routeKey: 'public' })
    }).not.toThrow()
  })
})

import { describe, expect, it } from 'vitest'
import {
  AUDIO_OUTPUT_FORMATS,
  isAudioDeliveryMetadata,
  isAudioDeliveryRequest,
  isAudioOutputFormat,
  isClientAudioOptions,
  isVoiceConfiguration,
} from './voice-contract-types.js'

describe('voice and audio contract guards', () => {
  it('owns a finite provider-neutral browser output format set', () => {
    expect(AUDIO_OUTPUT_FORMATS).toEqual(['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm'])
    expect(isAudioOutputFormat('audio/wav')).toBe(true)
    expect(isAudioOutputFormat('audio/gradium')).toBe(false)
  })

  it('accepts a logical voice configuration and rejects provider-shaped fields', () => {
    expect(isVoiceConfiguration({ voiceKey: 'guide', language: 'fr-CH' })).toBe(true)
    expect(isVoiceConfiguration({ voiceKey: 'guide', language: 'en_US' })).toBe(false)
    expect(isVoiceConfiguration({})).toBe(false)
    expect(isVoiceConfiguration({ voiceKey: 'guide', gradiumVoiceId: 'provider-id' })).toBe(false)
  })

  it('keeps client audio options limited to playback and delivery preference', () => {
    expect(isClientAudioOptions({ enabled: true, format: 'audio/mpeg' })).toBe(true)
    expect(isClientAudioOptions({ format: 'audio/mpeg', apiKey: 'secret' })).toBe(false)
    expect(isAudioDeliveryRequest({})).toBe(true)
    expect(isAudioDeliveryRequest({ format: 'audio/flac' })).toBe(false)
  })

  it('validates bounded binary delivery metadata without audio bytes', () => {
    expect(
      isAudioDeliveryMetadata({
        requestId: 'request_1',
        messageId: 'message_1',
        format: 'audio/wav',
        byteLength: 128,
        durationMs: 1_250,
      }),
    ).toBe(true)
    expect(
      isAudioDeliveryMetadata({
        requestId: 'request_1',
        messageId: 'message_1',
        format: 'audio/wav',
        byteLength: 0,
      }),
    ).toBe(false)
    expect(
      isAudioDeliveryMetadata({
        requestId: 'request_1',
        messageId: 'message_1',
        format: 'audio/wav',
        byteLength: 128,
        audio: 'raw bytes do not belong here',
      }),
    ).toBe(false)
    expect(
      isAudioDeliveryMetadata({
        requestId: 'r'.repeat(129),
        messageId: 'message_1',
        format: 'audio/wav',
        byteLength: 128,
      }),
    ).toBe(false)
  })
})

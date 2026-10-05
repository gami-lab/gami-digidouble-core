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
    expect(AUDIO_OUTPUT_FORMATS).toEqual([
      'audio/mpeg',
      'audio/ogg',
      'audio/pcm',
      'audio/wav',
      'audio/webm',
    ])
    expect(isAudioOutputFormat('audio/wav')).toBe(true)
    expect(isAudioOutputFormat('audio/gradium')).toBe(false)
  })

  it('accepts a provider (with an optional voice) and rejects unknown providers or extra fields', () => {
    expect(isVoiceConfiguration({ provider: 'gradium', voiceId: 'YTpq7expH9539ERJ' })).toBe(true)
    expect(isVoiceConfiguration({ provider: 'gradium' })).toBe(true)
    expect(isVoiceConfiguration({ provider: 'acme', voiceId: 'voice_1' })).toBe(false)
    expect(isVoiceConfiguration({ provider: 'gradium', voiceId: ' ' })).toBe(false)
    expect(isVoiceConfiguration({})).toBe(false)
    expect(
      isVoiceConfiguration({ provider: 'gradium', voiceId: 'voice_1', apiKey: 'secret' }),
    ).toBe(false)
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
        format: 'audio/pcm',
      }),
    ).toBe(true)
    expect(
      isAudioDeliveryMetadata({
        requestId: 'request_1',
        messageId: 'message_1',
        format: 'audio/wav',
        audio: 'raw bytes do not belong here',
      }),
    ).toBe(false)
    expect(
      isAudioDeliveryMetadata({
        requestId: 'r'.repeat(129),
        messageId: 'message_1',
        format: 'audio/wav',
      }),
    ).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import {
  isTextToSpeechError,
  normalizeTextToSpeechInput,
  TextToSpeechError,
  throwIfTextToSpeechCancelled,
} from './ITextToSpeechAdapter.js'

describe('text-to-speech application contract', () => {
  it('normalizes input and drops unknown fields', () => {
    expect(
      normalizeTextToSpeechInput({
        text: 'Hello',
        voiceId: '  voice_1  ',
        format: 'audio/wav',
        requestId: 'request-1',
        messageId: 'message-1',
        voice_id: 'provider-native-field',
      }),
    ).toEqual({
      text: 'Hello',
      voiceId: 'voice_1',
      format: 'audio/wav',
      requestId: 'request-1',
      messageId: 'message-1',
    })
  })

  it.each([
    ['empty text', { text: '' }, 'empty_text'],
    ['too much text', { text: 'a'.repeat(10_001) }, 'text_too_long'],
    ['invalid voice', { voiceId: ' ' }, 'invalid_voice'],
    ['oversized voice id', { voiceId: 'v'.repeat(129) }, 'invalid_voice'],
    ['invalid identity', { requestId: '' }, 'invalid_identity'],
  ] as const)('rejects %s with a typed invalid request', (_label, overrides, reason) => {
    expect(() =>
      normalizeTextToSpeechInput({
        text: 'Hello',
        voiceId: 'voice_1',
        format: 'audio/wav',
        requestId: 'request-1',
        messageId: 'message-1',
        ...overrides,
      }),
    ).toThrowError(new TextToSpeechError({ code: 'invalid_request', reason, retryable: false }))
  })

  it('distinguishes unsupported formats and cancellation phases', () => {
    expect(() =>
      normalizeTextToSpeechInput({
        text: 'Hello',
        voiceId: 'voice_1',
        format: 'audio/flac',
        requestId: 'request-1',
        messageId: 'message-1',
      }),
    ).toThrowError(
      new TextToSpeechError({ code: 'unsupported_format', format: 'audio/flac', retryable: false }),
    )

    const controller = new AbortController()
    controller.abort()
    expect(() => {
      throwIfTextToSpeechCancelled(controller.signal, 'before_synthesis')
    }).toThrowError(
      new TextToSpeechError({ code: 'cancelled', phase: 'before_synthesis', retryable: false }),
    )
  })

  it('identifies only the typed synthesis error', () => {
    expect(isTextToSpeechError(new TextToSpeechError({ code: 'timeout', retryable: true }))).toBe(
      true,
    )
    expect(isTextToSpeechError(new Error('timeout'))).toBe(false)
  })
})

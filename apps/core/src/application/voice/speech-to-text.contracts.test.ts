import { describe, expect, it } from 'vitest'
import {
  mapSpeechToTextError,
  normalizeFinalTranscript,
  normalizeSpeechToTextInput,
  SPEECH_TO_TEXT_LIMITS,
  SpeechToTextError,
} from '../ports/ISpeechToTextAdapter.js'
import { FakeSpeechToTextAdapter } from './test-support/fake-speech-to-text.adapter.js'

function validInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    conversationId: 'conversation-1',
    utteranceId: 'utterance-1',
    audio: Uint8Array.from([1, 2, 3]),
    mediaType: 'Audio/WebM;codecs=opus',
    language: ' en-us ',
    durationMs: 1_500,
    ...overrides,
  }
}

function expectSpeechFailure(
  action: () => unknown,
  code: SpeechToTextError['failure']['code'],
): void {
  try {
    action()
    throw new Error('Expected speech-to-text failure')
  } catch (error) {
    expect(error).toBeInstanceOf(SpeechToTextError)
    expect((error as SpeechToTextError).failure.code).toBe(code)
  }
}

describe('speech-to-text input policy', () => {
  it('normalizes bounded metadata and copies audio bytes', () => {
    const audio = Uint8Array.from([1, 2, 3])
    const input = normalizeSpeechToTextInput(validInput({ audio }))

    expect(input).toEqual({
      conversationId: 'conversation-1',
      utteranceId: 'utterance-1',
      audio: Uint8Array.from([1, 2, 3]),
      mediaType: 'audio/webm',
      language: 'en-US',
      durationMs: 1_500,
    })
    expect(input.audio).not.toBe(audio)
  })

  it.each([
    ['missing input', undefined, 'invalid_audio'],
    ['invalid bytes', validInput({ audio: 'not bytes' }), 'invalid_audio'],
    ['empty bytes', validInput({ audio: new Uint8Array() }), 'invalid_audio'],
    ['invalid conversation ID', validInput({ conversationId: 'conversation id' }), 'invalid_audio'],
    ['invalid utterance ID', validInput({ utteranceId: 'utterance/id' }), 'invalid_audio'],
    ['invalid media type', validInput({ mediaType: 'not media' }), 'invalid_audio'],
    ['invalid language', validInput({ language: 'en_US' }), 'invalid_audio'],
    ['invalid duration', validInput({ durationMs: 0 }), 'invalid_audio'],
  ] as const)('rejects %s', (_label, input, code) => {
    expectSpeechFailure(() => normalizeSpeechToTextInput(input), code)
  })

  it('rejects unsupported media after validating MIME syntax', () => {
    expectSpeechFailure(
      () => normalizeSpeechToTextInput(validInput({ mediaType: 'video/webm' })),
      'unsupported_media',
    )
  })

  it('rejects audio over the byte limit', () => {
    expectSpeechFailure(
      () =>
        normalizeSpeechToTextInput(
          validInput({ audio: new Uint8Array(SPEECH_TO_TEXT_LIMITS.maxAudioBytes + 1) }),
        ),
      'audio_too_large',
    )
  })

  it('rejects audio over the duration limit', () => {
    expectSpeechFailure(
      () =>
        normalizeSpeechToTextInput(
          validInput({ durationMs: SPEECH_TO_TEXT_LIMITS.maxDurationMs + 1 }),
        ),
      'audio_too_long',
    )
  })

  it('accepts an unknown duration without weakening the byte limit', () => {
    const input = normalizeSpeechToTextInput(validInput({ durationMs: undefined }))

    expect(input.durationMs).toBeUndefined()
  })
})

describe('speech-to-text transcript policy', () => {
  it('normalizes a final transcript for the existing message flow', () => {
    expect(normalizeFinalTranscript({ kind: 'final', transcript: '  hello\n  world  ' })).toBe(
      'hello world',
    )
  })

  it.each([
    ['missing result', undefined, 'malformed_transcription'],
    ['wrong result shape', { transcript: 'hello' }, 'malformed_transcription'],
    ['blank final', { kind: 'final', transcript: ' \n\t ' }, 'malformed_transcription'],
    ['interim result', { kind: 'interim', transcript: 'hello' }, 'malformed_transcription'],
  ] as const)('rejects %s', (_label, result, code) => {
    expectSpeechFailure(() => normalizeFinalTranscript(result), code)
  })

  it('rejects a transcript over the character limit', () => {
    expectSpeechFailure(
      () =>
        normalizeFinalTranscript({
          kind: 'final',
          transcript: 'a'.repeat(SPEECH_TO_TEXT_LIMITS.maxTranscriptCharacters + 1),
        }),
      'transcript_too_long',
    )
  })
})

describe('speech-to-text failure mapping and fake adapter', () => {
  it('maps timeout and provider failures without exposing provider details', () => {
    expect(
      mapSpeechToTextError({ name: 'TimeoutError', message: 'secret provider payload' }).failure,
    ).toEqual({
      code: 'timeout',
      retryable: true,
    })
    expect(mapSpeechToTextError(new Error('secret provider payload')).failure).toEqual({
      code: 'provider_failure',
      retryable: true,
    })
  })

  it('maps cancellation from an abort-like error and an aborted signal', () => {
    expect(mapSpeechToTextError({ name: 'AbortError' }).failure).toEqual({
      code: 'cancelled',
      phase: 'during_transcription',
      retryable: false,
    })
    const controller = new AbortController()
    controller.abort()
    expect(mapSpeechToTextError(new Error('provider error'), controller.signal).failure).toEqual({
      code: 'cancelled',
      phase: 'during_transcription',
      retryable: false,
    })
  })

  it('returns deterministic final and interim results and records bounded requests', async () => {
    const finalAdapter = new FakeSpeechToTextAdapter({ kind: 'final', transcript: ' hello ' })
    const input = normalizeSpeechToTextInput(validInput())

    await expect(finalAdapter.transcribe(input)).resolves.toEqual({
      kind: 'final',
      transcript: ' hello ',
    })
    expect(finalAdapter.requests).toHaveLength(1)

    const interimAdapter = new FakeSpeechToTextAdapter({ kind: 'interim', transcript: 'hello' })
    await expect(interimAdapter.transcribe(input)).resolves.toEqual({
      kind: 'interim',
      transcript: 'hello',
    })
  })

  it('does not start a fake transcription after cancellation', async () => {
    const adapter = new FakeSpeechToTextAdapter()
    const controller = new AbortController()
    controller.abort()

    await expect(
      adapter.transcribe(normalizeSpeechToTextInput(validInput()), { signal: controller.signal }),
    ).rejects.toMatchObject({
      failure: { code: 'cancelled', phase: 'before_transcription' },
    })
    expect(adapter.requests).toHaveLength(0)
  })
})

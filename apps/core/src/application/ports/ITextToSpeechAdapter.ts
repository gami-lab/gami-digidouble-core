import type { AudioDeliveryMetadata, AudioOutputFormat, VoiceConfiguration } from '@gami/shared'
import { isAudioDeliveryMetadata, isAudioOutputFormat, normalizeLanguageTag } from '@gami/shared'

export type TextToSpeechLimits = Readonly<{
  maxTextCharacters: number
  maxOutputBytes: number
}>

export type TextToSpeechProvider = 'null' | 'gradium'

export const TEXT_TO_SPEECH_LIMITS: TextToSpeechLimits = Object.freeze({
  maxTextCharacters: 10_000,
  maxOutputBytes: 10_000_000,
})

/** Normalized application input. Provider identifiers are resolved in infrastructure. */
export type TextToSpeechInput = Readonly<{
  text: string
  voice: VoiceConfiguration
  format: AudioOutputFormat
  requestId: string
  messageId: string
}>

export type TextToSpeechResult = Readonly<{
  audio: Readonly<Uint8Array>
  metadata: AudioDeliveryMetadata
}>

export type TextToSpeechOptions = Readonly<{
  signal?: AbortSignal
}>

/** Provider-neutral text-to-speech capability. */
export interface ITextToSpeechAdapter {
  synthesize(input: TextToSpeechInput, options?: TextToSpeechOptions): Promise<TextToSpeechResult>
}

export type TextToSpeechFailure =
  | Readonly<{
      code: 'invalid_request'
      reason: 'empty_text' | 'text_too_long' | 'invalid_voice' | 'invalid_identity'
      retryable: false
    }>
  | Readonly<{
      code: 'invalid_configuration'
      reason:
        | 'missing_credentials'
        | 'missing_voice_configuration'
        | 'missing_voice_mapping'
        | 'invalid_adapter_configuration'
      retryable: false
    }>
  | Readonly<{
      code: 'provider_unavailable'
      retryable: boolean
    }>
  | Readonly<{
      code: 'timeout'
      retryable: true
    }>
  | Readonly<{
      code: 'rate_limited'
      retryable: true
    }>
  | Readonly<{
      code: 'cancelled'
      phase: 'before_synthesis' | 'during_synthesis' | 'after_synthesis'
      retryable: false
    }>
  | Readonly<{
      code: 'unsupported_format'
      format: string
      retryable: false
    }>
  | Readonly<{
      code: 'invalid_provider_output'
      reason:
        | 'empty'
        | 'oversized'
        | 'invalid_content_type'
        | 'declared_size_mismatch'
        | 'identity_mismatch'
        | 'malformed_body'
      retryable: false
    }>

export class TextToSpeechError extends Error {
  readonly failure: TextToSpeechFailure

  constructor(failure: TextToSpeechFailure) {
    super(messageForTextToSpeechFailure(failure))
    this.name = 'TextToSpeechError'
    this.failure = failure
  }
}

export function isTextToSpeechError(error: unknown): error is TextToSpeechError {
  return error instanceof TextToSpeechError
}

// eslint-disable-next-line complexity
export function normalizeTextToSpeechInput(input: unknown): TextToSpeechInput {
  if (!isRecord(input)) {
    throw invalidRequest('invalid_identity')
  }

  const text = input['text']
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw invalidRequest('empty_text')
  }
  if (text.length > TEXT_TO_SPEECH_LIMITS.maxTextCharacters) {
    throw invalidRequest('text_too_long')
  }

  const voice = input['voice']
  if (
    !isRecord(voice) ||
    typeof voice['voiceKey'] !== 'string' ||
    voice['voiceKey'].trim() === ''
  ) {
    throw invalidRequest('invalid_voice')
  }
  const language = normalizeLanguageTag(voice['language'])
  if (language === null) {
    throw invalidRequest('invalid_voice')
  }

  const format = input['format']
  if (!isAudioOutputFormat(format)) {
    throw new TextToSpeechError({
      code: 'unsupported_format',
      format: typeof format === 'string' ? format : 'unknown',
      retryable: false,
    })
  }

  const requestId = input['requestId']
  const messageId = input['messageId']
  if (!isBoundedIdentity(requestId) || !isBoundedIdentity(messageId)) {
    throw invalidRequest('invalid_identity')
  }

  return {
    text,
    voice: {
      voiceKey: voice['voiceKey'].trim(),
      ...(language === undefined ? {} : { language }),
    },
    format,
    requestId,
    messageId,
  }
}

export function throwIfTextToSpeechCancelled(
  signal: AbortSignal | undefined,
  phase: 'before_synthesis' | 'during_synthesis' | 'after_synthesis',
): void {
  if (signal?.aborted) {
    throw new TextToSpeechError({ code: 'cancelled', phase, retryable: false })
  }
}

export function validateTextToSpeechResult(
  result: unknown,
  expected: Pick<TextToSpeechInput, 'requestId' | 'messageId' | 'format'>,
  maxOutputBytes = TEXT_TO_SPEECH_LIMITS.maxOutputBytes,
): TextToSpeechResult {
  if (!isRecord(result) || !(result['audio'] instanceof Uint8Array)) {
    throw invalidProviderOutput('malformed_body')
  }

  const audio = result['audio']
  if (audio.byteLength === 0) throw invalidProviderOutput('empty')
  if (audio.byteLength > maxOutputBytes) {
    throw invalidProviderOutput('oversized')
  }

  const metadata = result['metadata']
  if (!isAudioDeliveryMetadata(metadata)) throw invalidProviderOutput('malformed_body')
  if (!matchesExpectedResult(metadata, audio, expected)) {
    throw invalidProviderOutput('identity_mismatch')
  }

  return {
    audio: new Uint8Array(audio),
    metadata: { ...metadata },
  }
}

function matchesExpectedResult(
  metadata: AudioDeliveryMetadata,
  audio: Uint8Array,
  expected: Pick<TextToSpeechInput, 'requestId' | 'messageId' | 'format'>,
): boolean {
  return (
    metadata.byteLength === audio.byteLength &&
    metadata.requestId === expected.requestId &&
    metadata.messageId === expected.messageId &&
    metadata.format === expected.format
  )
}

function invalidRequest(
  reason: Extract<TextToSpeechFailure, { code: 'invalid_request' }>['reason'],
): TextToSpeechError {
  return new TextToSpeechError({ code: 'invalid_request', reason, retryable: false })
}

function invalidProviderOutput(
  reason: Extract<TextToSpeechFailure, { code: 'invalid_provider_output' }>['reason'],
): TextToSpeechError {
  return new TextToSpeechError({ code: 'invalid_provider_output', reason, retryable: false })
}

function messageForTextToSpeechFailure(failure: TextToSpeechFailure): string {
  switch (failure.code) {
    case 'invalid_request':
      return `Invalid text-to-speech request: ${failure.reason}.`
    case 'invalid_configuration':
      return `Invalid text-to-speech configuration: ${failure.reason}.`
    case 'provider_unavailable':
      return 'The text-to-speech provider is unavailable.'
    case 'timeout':
      return 'The text-to-speech provider timed out.'
    case 'rate_limited':
      return 'The text-to-speech provider rate limit was reached.'
    case 'cancelled':
      return 'Text-to-speech synthesis was cancelled.'
    case 'unsupported_format':
      return 'The requested audio format is unsupported.'
    case 'invalid_provider_output':
      return `The text-to-speech provider returned invalid audio: ${failure.reason}.`
  }
}

function isBoundedIdentity(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 128
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

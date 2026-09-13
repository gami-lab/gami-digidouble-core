/**
 * Provider-neutral speech-to-text policy.
 *
 * This module owns bounded input and transcript normalization. It deliberately
 * contains no transport, provider, or persistence types.
 */

import { normalizeLanguageTag } from '@gami/shared'

export const SPEECH_TO_TEXT_MEDIA_TYPES = [
  'audio/flac',
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
] as const

export type SpeechToTextMediaType = (typeof SPEECH_TO_TEXT_MEDIA_TYPES)[number]

export type SpeechToTextLimits = Readonly<{
  maxAudioBytes: number
  maxDurationMs: number
  maxTranscriptCharacters: number
  maxLanguageCharacters: number
  maxConversationIdCharacters: number
  maxUtteranceIdCharacters: number
}>

export const SPEECH_TO_TEXT_LIMITS: SpeechToTextLimits = Object.freeze({
  maxAudioBytes: 10_000_000,
  maxDurationMs: 120_000,
  maxTranscriptCharacters: 4_000,
  maxLanguageCharacters: 35,
  maxConversationIdCharacters: 128,
  maxUtteranceIdCharacters: 128,
})

export type SpeechToTextInput = Readonly<{
  conversationId: string
  utteranceId: string
  audio: Readonly<Uint8Array>
  mediaType: SpeechToTextMediaType
  language?: string
  durationMs?: number
}>

export type SpeechToTextResult =
  | Readonly<{
      kind: 'final'
      transcript: string
    }>
  | Readonly<{
      kind: 'interim'
      transcript: string
    }>

export type SpeechToTextFailure =
  | Readonly<{
      code: 'invalid_audio'
      reason:
        | 'missing_input'
        | 'invalid_bytes'
        | 'empty_audio'
        | 'invalid_conversation_id'
        | 'invalid_utterance_id'
        | 'invalid_media_type'
        | 'invalid_language'
        | 'invalid_duration'
      retryable: false
    }>
  | Readonly<{
      code: 'unsupported_media'
      mediaType: string
      retryable: false
    }>
  | Readonly<{
      code: 'audio_too_large'
      actualBytes: number
      maxBytes: number
      retryable: false
    }>
  | Readonly<{
      code: 'audio_too_long'
      actualDurationMs: number
      maxDurationMs: number
      retryable: false
    }>
  | Readonly<{
      code: 'transcript_too_long'
      actualCharacters: number
      maxCharacters: number
      retryable: false
    }>
  | Readonly<{
      code: 'malformed_response'
      retryable: false
    }>
  | Readonly<{
      code: 'timeout'
      retryable: true
    }>
  | Readonly<{
      code: 'provider_failure'
      retryable: boolean
    }>
  | Readonly<{
      code: 'provider_rejected'
      retryable: false
    }>
  | Readonly<{
      code: 'rate_limited'
      retryable: true
    }>
  | Readonly<{
      code: 'malformed_transcription'
      reason: 'invalid_shape' | 'blank' | 'interim'
      retryable: false
    }>
  | Readonly<{
      code: 'cancelled'
      phase: 'before_transcription' | 'during_transcription' | 'after_transcription'
      retryable: false
    }>

export class SpeechToTextError extends Error {
  readonly failure: SpeechToTextFailure

  constructor(failure: SpeechToTextFailure) {
    super(messageForSpeechToTextFailure(failure))
    this.name = 'SpeechToTextError'
    this.failure = failure
  }
}

export function isSpeechToTextError(error: unknown): error is SpeechToTextError {
  return error instanceof SpeechToTextError
}

/** Validate and copy a bounded speech request before handing it to an adapter. */
export function normalizeSpeechToTextInput(input: unknown): SpeechToTextInput {
  if (!isRecord(input)) {
    throw new SpeechToTextError({
      code: 'invalid_audio',
      reason: 'missing_input',
      retryable: false,
    })
  }

  const { conversationId, utteranceId } = normalizeSpeechIdentity(input)
  const audio = normalizeSpeechAudio(input['audio'])
  const mediaType = normalizeSpeechMediaType(input['mediaType'])
  const language = normalizeSpeechLanguage(input['language'])
  const durationMs = normalizeSpeechDuration(input['durationMs'])

  return {
    conversationId,
    utteranceId,
    audio,
    mediaType,
    ...(language !== undefined ? { language } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
  }
}

function normalizeSpeechIdentity(input: Record<string, unknown>): {
  conversationId: string
  utteranceId: string
} {
  const conversationId = normalizeOpaqueId(
    input['conversationId'],
    SPEECH_TO_TEXT_LIMITS.maxConversationIdCharacters,
  )
  if (conversationId === null) {
    throw new SpeechToTextError({
      code: 'invalid_audio',
      reason: 'invalid_conversation_id',
      retryable: false,
    })
  }

  const utteranceId = normalizeOpaqueId(
    input['utteranceId'],
    SPEECH_TO_TEXT_LIMITS.maxUtteranceIdCharacters,
  )
  if (utteranceId === null) {
    throw new SpeechToTextError({
      code: 'invalid_audio',
      reason: 'invalid_utterance_id',
      retryable: false,
    })
  }
  return { conversationId, utteranceId }
}

function normalizeSpeechAudio(value: unknown): Uint8Array {
  if (!(value instanceof Uint8Array)) {
    throw new SpeechToTextError({
      code: 'invalid_audio',
      reason: 'invalid_bytes',
      retryable: false,
    })
  }
  if (value.byteLength === 0) {
    throw new SpeechToTextError({ code: 'invalid_audio', reason: 'empty_audio', retryable: false })
  }
  if (value.byteLength > SPEECH_TO_TEXT_LIMITS.maxAudioBytes) {
    throw new SpeechToTextError({
      code: 'audio_too_large',
      actualBytes: value.byteLength,
      maxBytes: SPEECH_TO_TEXT_LIMITS.maxAudioBytes,
      retryable: false,
    })
  }
  return Uint8Array.from(value)
}

function normalizeSpeechMediaType(value: unknown): SpeechToTextMediaType {
  const mediaType = normalizeMediaType(value)
  if (mediaType === null) {
    throw new SpeechToTextError({
      code: 'invalid_audio',
      reason: 'invalid_media_type',
      retryable: false,
    })
  }
  if (!isSpeechToTextMediaType(mediaType)) {
    throw new SpeechToTextError({ code: 'unsupported_media', mediaType, retryable: false })
  }
  return mediaType
}

function normalizeSpeechLanguage(value: unknown): string | undefined {
  const language = normalizeSpeechToTextLanguage(value)
  if (language === null) {
    throw new SpeechToTextError({
      code: 'invalid_audio',
      reason: 'invalid_language',
      retryable: false,
    })
  }
  return language
}

export function normalizeSpeechToTextLanguage(value: unknown): string | undefined | null {
  return normalizeLanguage(value)
}

function normalizeSpeechDuration(value: unknown): number | undefined {
  const durationMs = normalizeDuration(value)
  if (durationMs === null) {
    throw new SpeechToTextError({
      code: 'invalid_audio',
      reason: 'invalid_duration',
      retryable: false,
    })
  }
  if (durationMs !== undefined && durationMs > SPEECH_TO_TEXT_LIMITS.maxDurationMs) {
    throw new SpeechToTextError({
      code: 'audio_too_long',
      actualDurationMs: durationMs,
      maxDurationMs: SPEECH_TO_TEXT_LIMITS.maxDurationMs,
      retryable: false,
    })
  }
  return durationMs
}

/** Accept only a non-blank final result and normalize whitespace for the message path. */
export function normalizeFinalTranscript(result: unknown): string {
  if (!isRecord(result) || (result['kind'] !== 'final' && result['kind'] !== 'interim')) {
    throw new SpeechToTextError({
      code: 'malformed_transcription',
      reason: 'invalid_shape',
      retryable: false,
    })
  }
  if (result['kind'] === 'interim') {
    throw new SpeechToTextError({
      code: 'malformed_transcription',
      reason: 'interim',
      retryable: false,
    })
  }

  const transcript = result['transcript']
  if (typeof transcript !== 'string') {
    throw new SpeechToTextError({
      code: 'malformed_transcription',
      reason: 'invalid_shape',
      retryable: false,
    })
  }

  const normalized = transcript.trim().replace(/\s+/gu, ' ')
  const actualCharacters = Array.from(normalized).length
  if (actualCharacters === 0) {
    throw new SpeechToTextError({
      code: 'malformed_transcription',
      reason: 'blank',
      retryable: false,
    })
  }
  if (actualCharacters > SPEECH_TO_TEXT_LIMITS.maxTranscriptCharacters) {
    throw new SpeechToTextError({
      code: 'transcript_too_long',
      actualCharacters,
      maxCharacters: SPEECH_TO_TEXT_LIMITS.maxTranscriptCharacters,
      retryable: false,
    })
  }

  return normalized
}

export function throwIfSpeechToTextCancelled(
  signal: AbortSignal | undefined,
  phase: 'before_transcription' | 'during_transcription' | 'after_transcription',
): void {
  if (signal?.aborted === true) {
    throw new SpeechToTextError({ code: 'cancelled', phase, retryable: false })
  }
}

/** Map adapter failures to finite, provider-neutral application failures. */
export function mapSpeechToTextError(
  error: unknown,
  signal?: AbortSignal,
  phase:
    | 'before_transcription'
    | 'during_transcription'
    | 'after_transcription' = 'during_transcription',
): SpeechToTextError {
  if (isSpeechToTextError(error)) return error
  if (signal?.aborted === true || isAbortLike(error)) {
    return new SpeechToTextError({ code: 'cancelled', phase, retryable: false })
  }
  if (isTimeoutLike(error)) {
    return new SpeechToTextError({ code: 'timeout', retryable: true })
  }
  return new SpeechToTextError({ code: 'provider_failure', retryable: true })
}

function normalizeOpaqueId(value: unknown, maxCharacters: number): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (
    normalized.length === 0 ||
    normalized.length > maxCharacters ||
    !/^[A-Za-z0-9][A-Za-z0-9._:~-]*$/u.test(normalized)
  ) {
    return null
  }
  return normalized
}

function normalizeMediaType(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (normalized.length === 0) return null
  const [baseType, ...parameters] = normalized.split(';')
  if (baseType === undefined || !/^[a-z]+\/[a-z0-9.+-]+$/u.test(baseType)) return null
  if (parameters.some((parameter) => !/^\s*[a-z0-9-]+\s*=\s*[^;]+\s*$/u.test(parameter))) {
    return null
  }
  return baseType
}

function isSpeechToTextMediaType(value: string): value is SpeechToTextMediaType {
  return (SPEECH_TO_TEXT_MEDIA_TYPES as readonly string[]).includes(value)
}

function normalizeLanguage(value: unknown): string | undefined | null {
  const normalized = normalizeLanguageTag(value)
  if (
    normalized !== undefined &&
    normalized !== null &&
    normalized.length > SPEECH_TO_TEXT_LIMITS.maxLanguageCharacters
  ) {
    return null
  }
  return normalized
}

function normalizeDuration(value: unknown): number | undefined | null {
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAbortLike(error: unknown): boolean {
  return isRecord(error) && (error['name'] === 'AbortError' || error['code'] === 'ABORT_ERR')
}

function isTimeoutLike(error: unknown): boolean {
  return (
    isRecord(error) &&
    (error['name'] === 'TimeoutError' ||
      error['code'] === 'ETIMEDOUT' ||
      error['code'] === 'TIMEOUT')
  )
}

const SPEECH_TO_TEXT_FAILURE_MESSAGES: Readonly<Record<SpeechToTextFailure['code'], string>> = {
  invalid_audio: 'Speech audio input is invalid.',
  unsupported_media: 'Speech audio media type is not supported.',
  audio_too_large: 'Speech audio exceeds the byte limit.',
  audio_too_long: 'Speech audio exceeds the duration limit.',
  transcript_too_long: 'Speech transcript exceeds the character limit.',
  malformed_response: 'Speech provider returned an invalid response.',
  timeout: 'Speech transcription timed out.',
  provider_failure: 'Speech transcription failed.',
  provider_rejected: 'Speech transcription request was rejected.',
  rate_limited: 'Speech transcription is temporarily rate limited.',
  malformed_transcription: 'Speech transcription was not a valid final result.',
  cancelled: 'Speech transcription was cancelled.',
}

function messageForSpeechToTextFailure(failure: SpeechToTextFailure): string {
  return SPEECH_TO_TEXT_FAILURE_MESSAGES[failure.code]
}

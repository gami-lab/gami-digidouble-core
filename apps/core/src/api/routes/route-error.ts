import { fail, type ErrorCode } from '@gami/shared'
import {
  isSpeechToTextError,
  type SpeechToTextFailure,
} from '../../application/ports/ISpeechToTextAdapter.js'
import {
  isTextToSpeechError,
  type TextToSpeechFailure,
} from '../../application/ports/ITextToSpeechAdapter.js'
import { isVoiceTurnError } from '../../application/use-cases/voice-turn/voice-turn.types.js'
import { DomainError } from '../../domain/errors.js'
import { LlmError } from '../../infrastructure/llm/index.js'

export function handleRouteError(error: unknown): {
  statusCode: number
  body: ReturnType<typeof fail>
} {
  if (error instanceof DomainError) {
    const code = error.code as string
    if (code === 'NOT_FOUND') return { statusCode: 404, body: fail('NOT_FOUND', error.message) }
    if (code === 'CONFLICT') return { statusCode: 409, body: fail('CONFLICT', error.message) }
    if (code === 'INVALID_INPUT' || code === 'VALIDATION_ERROR') {
      return { statusCode: 400, body: fail('VALIDATION_ERROR', error.message) }
    }
  }

  if (isVoiceTurnError(error)) {
    return { statusCode: 409, body: fail('CONFLICT', error.message) }
  }

  if (isSpeechToTextError(error))
    return mapSpeechToTextRouteError(error.failure.code, error.message)
  if (isTextToSpeechError(error)) {
    return mapTextToSpeechRouteError(error.failure, error.message)
  }
  if (error instanceof LlmError) {
    return { statusCode: 502, body: fail('EXTERNAL_SERVICE_ERROR', error.message) }
  }
  return { statusCode: 500, body: fail('INTERNAL_ERROR', 'Internal server error') }
}

function mapTextToSpeechRouteError(
  failure: TextToSpeechFailure,
  safeMessage: string,
): { statusCode: number; body: ReturnType<typeof fail> } {
  if (
    failure.code === 'invalid_configuration' &&
    failure.reason === 'missing_voice_configuration'
  ) {
    return { statusCode: 409, body: fail('CONFLICT', safeMessage) }
  }
  const mapping = TEXT_TO_SPEECH_ROUTE_ERRORS[failure.code]
  return { statusCode: mapping.statusCode, body: fail(mapping.errorCode, safeMessage) }
}

function mapSpeechToTextRouteError(
  code: SpeechToTextFailure['code'],
  safeMessage: string,
): { statusCode: number; body: ReturnType<typeof fail> } {
  const mapping = SPEECH_TO_TEXT_ROUTE_ERRORS[code]
  return { statusCode: mapping.statusCode, body: fail(mapping.errorCode, safeMessage) }
}

const SPEECH_TO_TEXT_ROUTE_ERRORS: Readonly<
  Record<SpeechToTextFailure['code'], { statusCode: number; errorCode: ErrorCode }>
> = {
  invalid_audio: { statusCode: 400, errorCode: 'VALIDATION_ERROR' },
  unsupported_media: { statusCode: 400, errorCode: 'VALIDATION_ERROR' },
  audio_too_large: { statusCode: 400, errorCode: 'VALIDATION_ERROR' },
  audio_too_long: { statusCode: 400, errorCode: 'VALIDATION_ERROR' },
  transcript_too_long: { statusCode: 400, errorCode: 'VALIDATION_ERROR' },
  malformed_response: { statusCode: 502, errorCode: 'PROVIDER_ERROR' },
  timeout: { statusCode: 504, errorCode: 'TIMEOUT' },
  provider_failure: { statusCode: 502, errorCode: 'PROVIDER_ERROR' },
  provider_rejected: { statusCode: 502, errorCode: 'PROVIDER_ERROR' },
  rate_limited: { statusCode: 429, errorCode: 'RATE_LIMITED' },
  malformed_transcription: { statusCode: 400, errorCode: 'VALIDATION_ERROR' },
  cancelled: { statusCode: 409, errorCode: 'CONFLICT' },
}

const TEXT_TO_SPEECH_ROUTE_ERRORS: Readonly<
  Record<TextToSpeechFailure['code'], { statusCode: number; errorCode: ErrorCode }>
> = {
  invalid_request: { statusCode: 400, errorCode: 'VALIDATION_ERROR' },
  invalid_configuration: { statusCode: 502, errorCode: 'PROVIDER_ERROR' },
  provider_unavailable: { statusCode: 502, errorCode: 'PROVIDER_ERROR' },
  timeout: { statusCode: 504, errorCode: 'TIMEOUT' },
  rate_limited: { statusCode: 429, errorCode: 'RATE_LIMITED' },
  cancelled: { statusCode: 409, errorCode: 'CONFLICT' },
  unsupported_format: { statusCode: 400, errorCode: 'VALIDATION_ERROR' },
  invalid_provider_output: { statusCode: 502, errorCode: 'PROVIDER_ERROR' },
}

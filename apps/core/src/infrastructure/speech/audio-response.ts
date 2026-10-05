import type { AudioOutputFormat } from '@gami/shared'
import {
  isTextToSpeechError,
  TextToSpeechError,
  type TextToSpeechFailure,
  type TextToSpeechLimits,
} from '../../application/ports/ITextToSpeechAdapter.js'

/** Shared HTTP audio-response handling for the text-to-speech adapters. */
export interface AudioResponse {
  readonly headers: Pick<Headers, 'get'>
  readonly body: ReadableStream<Uint8Array> | null
}

/** Thrown internally when the adapter's own timeout fired; mapped to a `timeout` failure. */
export class TimeoutMarker extends Error {}

// eslint-disable-next-line complexity
export async function readAudioResponse(
  response: AudioResponse,
  format: AudioOutputFormat,
  limits: TextToSpeechLimits,
  timeoutSignal: AbortSignal,
  callerSignal: AbortSignal | undefined,
): Promise<Uint8Array> {
  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
  if (!isExpectedContentType(contentType, format)) {
    await cancelResponseBody(response)
    throw invalidOutput('invalid_content_type')
  }

  const declaredLength = parseDeclaredLength(response.headers.get('content-length'))
  if (declaredLength !== undefined && declaredLength > limits.maxOutputBytes) {
    await cancelResponseBody(response)
    throw invalidOutput('oversized')
  }

  if (response.body === null) throw invalidOutput('malformed_body')
  const bytes = await readBoundedBody(
    response.body,
    limits.maxOutputBytes,
    timeoutSignal,
    callerSignal,
  )

  if (callerSignal?.aborted === true) {
    throw new TextToSpeechError({
      code: 'cancelled',
      phase: 'during_synthesis',
      retryable: false,
    })
  }
  if (timeoutSignal.aborted) throw new TimeoutMarker()
  if (bytes.byteLength > limits.maxOutputBytes) throw invalidOutput('oversized')
  if (bytes.byteLength === 0) throw invalidOutput('empty')
  if (declaredLength !== undefined && declaredLength !== bytes.byteLength) {
    throw invalidOutput('declared_size_mismatch')
  }
  return bytes
}

// eslint-disable-next-line complexity
async function readBoundedBody(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
  timeoutSignal: AbortSignal,
  callerSignal: AbortSignal | undefined,
): Promise<Uint8Array> {
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  const onAbort = (): void => {
    void reader.cancel().catch(() => undefined)
  }
  timeoutSignal.addEventListener('abort', onAbort, { once: true })
  try {
    if (callerSignal?.aborted === true) {
      throw new TextToSpeechError({
        code: 'cancelled',
        phase: 'during_synthesis',
        retryable: false,
      })
    }
    if (timeoutSignal.aborted) throw new TimeoutMarker()
    let done = false
    while (!done) {
      const next = await reader.read()
      done = next.done
      if (done) continue
      if (!(next.value instanceof Uint8Array)) throw invalidOutput('malformed_body')
      total += next.value.byteLength
      if (total > maxBytes) throw invalidOutput('oversized')
      chunks.push(next.value)
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    if (callerSignal?.aborted === true) {
      throw new TextToSpeechError({
        code: 'cancelled',
        phase: 'during_synthesis',
        retryable: false,
      })
    }
    if (timeoutSignal.aborted) throw new TimeoutMarker()
    if (isTextToSpeechError(error)) throw error
    throw invalidOutput('malformed_body')
  } finally {
    timeoutSignal.removeEventListener('abort', onAbort)
    reader.releaseLock()
  }

  const output = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.byteLength
  }
  return output
}

export async function cancelResponseBody(response: AudioResponse): Promise<void> {
  if (response.body === null) return
  await response.body.cancel().catch(() => undefined)
}

function isExpectedContentType(
  contentType: string | undefined,
  format: AudioOutputFormat,
): boolean {
  if (contentType === undefined) return false
  if (format === 'audio/wav') return contentType === 'audio/wav' || contentType === 'audio/x-wav'
  if (format === 'audio/ogg') return contentType === 'audio/ogg' || contentType === 'audio/opus'
  if (format === 'audio/mpeg') return contentType === 'audio/mpeg' || contentType === 'audio/mp3'
  return false
}

function parseDeclaredLength(value: string | null): number | undefined {
  if (value === null) return undefined
  if (!/^\d+$/.test(value)) throw invalidOutput('declared_size_mismatch')
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) throw invalidOutput('declared_size_mismatch')
  return parsed
}

function invalidOutput(
  reason: Extract<TextToSpeechFailure, { code: 'invalid_provider_output' }>['reason'],
): TextToSpeechError {
  return new TextToSpeechError({ code: 'invalid_provider_output', reason, retryable: false })
}

export function failureForStatus(statusCode: number): TextToSpeechError {
  if (statusCode === 429) {
    return new TextToSpeechError({ code: 'rate_limited', retryable: true })
  }
  if (statusCode === 408 || statusCode === 504) {
    return new TextToSpeechError({ code: 'timeout', retryable: true })
  }
  if (statusCode === 401 || statusCode === 403) {
    return new TextToSpeechError({
      code: 'invalid_configuration',
      reason: 'invalid_adapter_configuration',
      retryable: false,
    })
  }
  if (statusCode >= 400 && statusCode < 500) {
    return new TextToSpeechError({ code: 'provider_unavailable', retryable: false })
  }
  return new TextToSpeechError({ code: 'provider_unavailable', retryable: true })
}

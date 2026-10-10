import type { AudioOutputFormat } from '@gami/shared'
import {
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

/**
 * Checks the audio headers, then returns the bounded body as chunks that stream as they arrive.
 * Iterating ends the provider request; failures surface as typed errors or a `TimeoutMarker`.
 */
export async function streamAudioResponse(
  response: AudioResponse,
  format: AudioOutputFormat,
  limits: TextToSpeechLimits,
  timeoutSignal: AbortSignal,
  callerSignal: AbortSignal | undefined,
): Promise<AsyncGenerator<Uint8Array>> {
  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
  if (!isExpectedContentType(contentType, format)) {
    await cancelResponseBody(response)
    throw invalidOutput('invalid_content_type')
  }

  let declaredLength: number | undefined
  try {
    declaredLength = parseDeclaredLength(response.headers.get('content-length'))
  } catch (error) {
    await cancelResponseBody(response)
    throw error
  }
  if (declaredLength !== undefined && declaredLength > limits.maxOutputBytes) {
    await cancelResponseBody(response)
    throw invalidOutput('oversized')
  }

  if (response.body === null) throw invalidOutput('malformed_body')
  return readBoundedChunks(response.body, {
    maxBytes: limits.maxOutputBytes,
    declaredLength,
    timeoutSignal,
    callerSignal,
  })
}

// eslint-disable-next-line complexity -- retained non-linear boundary mapping is clearer together
async function* readBoundedChunks(
  body: ReadableStream<Uint8Array>,
  bounds: {
    maxBytes: number
    declaredLength: number | undefined
    timeoutSignal: AbortSignal
    callerSignal: AbortSignal | undefined
  },
): AsyncGenerator<Uint8Array> {
  const { maxBytes, declaredLength, timeoutSignal, callerSignal } = bounds
  const reader = body.getReader()
  let total = 0
  let finished = false
  const onAbort = (): void => {
    void reader.cancel().catch(() => undefined)
  }
  timeoutSignal.addEventListener('abort', onAbort, { once: true })
  try {
    for (;;) {
      throwIfStopped(timeoutSignal, callerSignal)
      let next: Awaited<ReturnType<typeof reader.read>>
      try {
        next = await reader.read()
      } catch {
        throwIfStopped(timeoutSignal, callerSignal)
        throw invalidOutput('malformed_body')
      }
      if (next.done) break
      if (!(next.value instanceof Uint8Array)) throw invalidOutput('malformed_body')
      total += next.value.byteLength
      if (total > maxBytes) throw invalidOutput('oversized')
      if (next.value.byteLength > 0) yield next.value
    }
    // A cancelled reader ends like a finished one; the signals tell them apart.
    throwIfStopped(timeoutSignal, callerSignal)
    if (total === 0) throw invalidOutput('empty')
    if (declaredLength !== undefined && declaredLength !== total) {
      throw invalidOutput('declared_size_mismatch')
    }
    finished = true
  } finally {
    timeoutSignal.removeEventListener('abort', onAbort)
    if (!finished) await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

function throwIfStopped(timeoutSignal: AbortSignal, callerSignal: AbortSignal | undefined): void {
  if (callerSignal?.aborted === true) {
    throw new TextToSpeechError({ code: 'cancelled', phase: 'during_synthesis', retryable: false })
  }
  if (timeoutSignal.aborted) throw new TimeoutMarker()
}

export type AudioStreamOutcome =
  Readonly<{ byteCount: number; failure?: undefined }> | Readonly<{ failure: TextToSpeechFailure }>

/**
 * Reports exactly one outcome when the stream completes, fails, or is abandoned by its consumer,
 * mapping failures to typed errors.
 */
export async function* settleAudioStream(
  chunks: AsyncIterable<Uint8Array>,
  mapError: (error: unknown) => TextToSpeechError,
  settle: (outcome: AudioStreamOutcome) => void,
): AsyncGenerator<Uint8Array> {
  let byteCount = 0
  let settled = false
  try {
    for await (const chunk of chunks) {
      byteCount += chunk.byteLength
      yield chunk
    }
    settled = true
    settle({ byteCount })
  } catch (error) {
    const mapped = mapError(error)
    settled = true
    settle({ failure: mapped.failure })
    throw mapped
  } finally {
    if (!settled) {
      settle({ failure: { code: 'cancelled', phase: 'during_synthesis', retryable: false } })
    }
  }
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
  if (format === 'audio/pcm') {
    return contentType === 'audio/pcm' || contentType === 'application/octet-stream'
  }
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

import crypto from 'node:crypto'
import type { IObservabilityAdapter } from '../../application/ports/IObservabilityAdapter.js'
import {
  isTextToSpeechError,
  normalizeTextToSpeechInput,
  TextToSpeechError,
  throwIfTextToSpeechCancelled,
  type ITextToSpeechAdapter,
  type TextToSpeechFailure,
  type TextToSpeechInput,
  type TextToSpeechLimits,
  type TextToSpeechOptions,
  type TextToSpeechResult,
  type TextToSpeechProvider,
} from '../../application/ports/ITextToSpeechAdapter.js'
import type { AudioOutputFormat } from '@gami/shared'

export const DEFAULT_GRADIUM_ENDPOINT = 'https://api.gradium.ai/api/post/speech/tts'
export const DEFAULT_GRADIUM_TIMEOUT_MS = 30_000
const MIN_TIMEOUT_MS = 100
const MAX_TIMEOUT_MS = 120_000
const MAX_ENDPOINT_CHARACTERS = 500

export type GradiumTextToSpeechConfig = Readonly<{
  apiKey: string
  endpoint: string
  timeoutMs: number
  limits: TextToSpeechLimits
  voiceMap: Readonly<Record<string, string>>
}>

export type GradiumTextToSpeechFactoryConfig = Readonly<{
  provider: TextToSpeechProvider
  apiKey?: string
  endpoint: string
  timeoutMs: number
  limits: TextToSpeechLimits
  voiceMap: Readonly<Record<string, string>>
}>

export type GradiumTransportRequest = Readonly<{
  url: string
  headers: Readonly<{
    'Content-Type': 'application/json'
    'x-api-key': string
  }>
  body: string
  signal: AbortSignal
}>

export interface GradiumTransportResponse {
  readonly status: number
  readonly headers: Pick<Headers, 'get'>
  readonly body: ReadableStream<Uint8Array> | null
  arrayBuffer(): Promise<ArrayBuffer>
}

export interface GradiumTransport {
  post(request: GradiumTransportRequest): Promise<GradiumTransportResponse>
}

export class FetchGradiumTransport implements GradiumTransport {
  async post(request: GradiumTransportRequest): Promise<GradiumTransportResponse> {
    return fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: request.body,
      signal: request.signal,
    })
  }
}

export function createTextToSpeechAdapter(
  config: GradiumTextToSpeechFactoryConfig,
  observability: IObservabilityAdapter,
  transport?: GradiumTransport,
): ITextToSpeechAdapter {
  if (config.provider === 'null') return new NullTextToSpeechAdapter()
  if (config.apiKey === undefined || config.apiKey.trim().length === 0) {
    return new UnconfiguredTextToSpeechAdapter()
  }
  return new GradiumTextToSpeechAdapter(
    { ...config, apiKey: config.apiKey },
    observability,
    transport,
  )
}

export class NullTextToSpeechAdapter implements ITextToSpeechAdapter {
  synthesize(
    _input: TextToSpeechInput,
    _options?: TextToSpeechOptions,
  ): Promise<TextToSpeechResult> {
    return Promise.reject(new TextToSpeechError({ code: 'provider_unavailable', retryable: false }))
  }
}

export class UnconfiguredTextToSpeechAdapter implements ITextToSpeechAdapter {
  synthesize(
    _input: TextToSpeechInput,
    _options?: TextToSpeechOptions,
  ): Promise<TextToSpeechResult> {
    return Promise.reject(
      new TextToSpeechError({
        code: 'invalid_configuration',
        reason: 'missing_credentials',
        retryable: false,
      }),
    )
  }
}

export class GradiumTextToSpeechAdapter implements ITextToSpeechAdapter {
  private readonly config: GradiumTextToSpeechConfig
  private readonly transport: GradiumTransport

  constructor(
    config: GradiumTextToSpeechConfig,
    private readonly observability: IObservabilityAdapter,
    transport: GradiumTransport = new FetchGradiumTransport(),
  ) {
    validateConfig(config)
    this.config = config
    this.transport = transport
  }

  async synthesize(
    input: TextToSpeechInput,
    options?: TextToSpeechOptions,
  ): Promise<TextToSpeechResult> {
    const startedAt = Date.now()
    let normalizedInput: TextToSpeechInput | undefined
    let statusCode: number | undefined

    try {
      const execution = await this.executeSynthesis(input, options, (status) => {
        statusCode = status
      })
      normalizedInput = execution.input
      this.trace({
        requestId: execution.input.requestId,
        input: execution.input,
        latencyMs: Date.now() - startedAt,
        outcome: 'success',
        result: execution.result,
      })
      return execution.result
    } catch (error) {
      const mapped = mapGradiumError(error, options?.signal, error instanceof TimeoutMarker)
      if (normalizedInput === undefined) {
        try {
          normalizedInput = normalizeTextToSpeechInput(input)
        } catch {
          // Invalid input is reported through the typed failure only.
        }
      }
      this.trace({
        ...(normalizedInput === undefined ? {} : { requestId: normalizedInput.requestId }),
        ...(normalizedInput === undefined ? {} : { input: normalizedInput }),
        latencyMs: Date.now() - startedAt,
        outcome: 'failure',
        failure: mapped.failure,
        ...(statusCode === undefined ? {} : { statusCode }),
      })
      throw mapped
    }
  }

  // eslint-disable-next-line complexity
  private async executeSynthesis(
    input: TextToSpeechInput,
    options: TextToSpeechOptions | undefined,
    onStatusCode: (statusCode: number) => void,
  ): Promise<{ input: TextToSpeechInput; result: TextToSpeechResult }> {
    throwIfTextToSpeechCancelled(options?.signal, 'before_synthesis')
    const normalizedInput = normalizeTextToSpeechInput(input)
    const providerVoiceId = this.config.voiceMap[normalizedInput.voice.voiceKey]
    if (providerVoiceId === undefined || providerVoiceId.trim().length === 0) {
      throw new TextToSpeechError({
        code: 'invalid_configuration',
        reason: 'missing_voice_mapping',
        retryable: false,
      })
    }
    const providerFormat = mapOutputFormat(normalizedInput.format)
    const timeout = createTimeoutSignal(options?.signal, this.config.timeoutMs)

    try {
      const response = await this.transport.post({
        url: this.config.endpoint,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
        },
        body: JSON.stringify({
          text: normalizedInput.text,
          voice_id: providerVoiceId,
          output_format: providerFormat,
          only_audio: true,
        }),
        signal: timeout.signal,
      })
      onStatusCode(response.status)
      if (response.status < 200 || response.status >= 300) {
        await cancelResponseBody(response)
        throw failureForStatus(response.status)
      }
      const audio = await readAudioResponse(response, normalizedInput.format, this.config.limits)
      throwIfTextToSpeechCancelled(options?.signal, 'after_synthesis')
      return {
        input: normalizedInput,
        result: {
          audio,
          metadata: {
            requestId: normalizedInput.requestId,
            messageId: normalizedInput.messageId,
            format: normalizedInput.format,
            byteLength: audio.byteLength,
          },
        },
      }
    } catch (error) {
      if (error instanceof TextToSpeechError) throw error
      if (timeout.timedOut()) throw new TimeoutMarker()
      throw error
    } finally {
      timeout.clear()
    }
  }

  private trace(args: {
    requestId?: string
    input?: TextToSpeechInput
    latencyMs: number
    outcome: 'success' | 'failure'
    result?: TextToSpeechResult
    failure?: TextToSpeechFailure
    statusCode?: number
  }): void {
    void this.observability
      .trace({
        requestId: args.requestId ?? crypto.randomUUID(),
        event: args.failure === undefined ? 'text_to_speech' : 'text_to_speech.error',
        ...(args.result === undefined
          ? {}
          : {
              output: {
                byteCount: args.result.metadata.byteLength,
                format: args.result.metadata.format,
              },
            }),
        ...(args.failure === undefined ? {} : { output: { code: args.failure.code } }),
        latencyMs: args.latencyMs,
        metadata: {
          provider: 'gradium',
          outcome: args.outcome,
          ...(args.result === undefined
            ? {}
            : { byteCount: args.result.metadata.byteLength, format: args.result.metadata.format }),
          ...(args.statusCode === undefined ? {} : { statusCode: args.statusCode }),
          ...(args.failure === undefined ? {} : { failureCode: args.failure.code }),
        },
      })
      .catch(() => undefined)
  }
}

class TimeoutMarker extends Error {}

// eslint-disable-next-line complexity
function validateConfig(config: GradiumTextToSpeechConfig): void {
  if (config.apiKey.trim().length === 0) {
    throw new Error('Missing GRADIUM_API_KEY.')
  }
  if (
    config.endpoint.trim().length === 0 ||
    config.endpoint.length > MAX_ENDPOINT_CHARACTERS ||
    !isHttpUrl(config.endpoint)
  ) {
    throw new Error('Invalid GRADIUM_ENDPOINT.')
  }
  if (
    !Number.isInteger(config.timeoutMs) ||
    config.timeoutMs < MIN_TIMEOUT_MS ||
    config.timeoutMs > MAX_TIMEOUT_MS
  ) {
    throw new Error('Invalid GRADIUM_TIMEOUT_MS.')
  }
  if (
    !Number.isInteger(config.limits.maxTextCharacters) ||
    config.limits.maxTextCharacters <= 0 ||
    !Number.isInteger(config.limits.maxOutputBytes) ||
    config.limits.maxOutputBytes <= 0
  ) {
    throw new Error('Invalid text-to-speech limits.')
  }
  for (const [logicalKey, providerVoiceId] of Object.entries(config.voiceMap)) {
    if (logicalKey.trim().length === 0 || providerVoiceId.trim().length === 0) {
      throw new Error('Invalid GRADIUM_VOICE_MAP.')
    }
  }
}

function mapOutputFormat(format: AudioOutputFormat): 'wav' | 'opus' {
  if (format === 'audio/wav') return 'wav'
  if (format === 'audio/ogg') return 'opus'
  throw new TextToSpeechError({ code: 'unsupported_format', format, retryable: false })
}

// eslint-disable-next-line complexity
async function readAudioResponse(
  response: GradiumTransportResponse,
  format: AudioOutputFormat,
  limits: TextToSpeechLimits,
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

  const bytes =
    response.body === null
      ? new Uint8Array(await response.arrayBuffer())
      : await readBoundedBody(response.body, limits.maxOutputBytes)

  if (bytes.byteLength > limits.maxOutputBytes) throw invalidOutput('oversized')
  if (bytes.byteLength === 0) throw invalidOutput('empty')
  if (declaredLength !== undefined && declaredLength !== bytes.byteLength) {
    throw invalidOutput('declared_size_mismatch')
  }
  return bytes
}

async function readBoundedBody(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<Uint8Array> {
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
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
    if (isTextToSpeechError(error)) throw error
    throw invalidOutput('malformed_body')
  } finally {
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

async function cancelResponseBody(response: GradiumTransportResponse): Promise<void> {
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

function failureForStatus(statusCode: number): TextToSpeechError {
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

function mapGradiumError(
  error: unknown,
  callerSignal: AbortSignal | undefined,
  timedOut: boolean,
): TextToSpeechError {
  if (isTextToSpeechError(error)) return error
  if (timedOut) return new TextToSpeechError({ code: 'timeout', retryable: true })
  if (callerSignal?.aborted) {
    return new TextToSpeechError({ code: 'cancelled', phase: 'during_synthesis', retryable: false })
  }
  return new TextToSpeechError({ code: 'provider_unavailable', retryable: true })
}

function createTimeoutSignal(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; timedOut: () => boolean; clear: () => void } {
  const timeoutController = new AbortController()
  let timedOut = false
  const timeoutHandle = setTimeout(() => {
    timedOut = true
    timeoutController.abort()
  }, timeoutMs)
  return {
    signal:
      callerSignal === undefined
        ? timeoutController.signal
        : AbortSignal.any([callerSignal, timeoutController.signal]),
    timedOut: () => timedOut,
    clear: () => {
      clearTimeout(timeoutHandle)
    },
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

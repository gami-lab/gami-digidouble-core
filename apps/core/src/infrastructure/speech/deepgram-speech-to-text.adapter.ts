import crypto from 'node:crypto'
import {
  isSpeechToTextError,
  mapSpeechToTextError,
  normalizeFinalTranscript,
  normalizeSpeechToTextLanguage,
  normalizeSpeechToTextInput,
  throwIfSpeechToTextCancelled,
  type ISpeechToTextAdapter,
  type SpeechToTextFailure,
  type SpeechToTextInput,
  type SpeechToTextLimits,
  type SpeechToTextOptions,
  type SpeechToTextResult,
} from '../../application/ports/ISpeechToTextAdapter.js'
import { SpeechToTextError } from '../../application/ports/ISpeechToTextAdapter.js'
import type { IObservabilityAdapter } from '../../application/ports/IObservabilityAdapter.js'

const DEEPGRAM_LISTEN_URL = 'https://api.deepgram.com/v1/listen'
const MIN_TIMEOUT_MS = 100
const MAX_TIMEOUT_MS = 120_000
const MAX_MODEL_CHARACTERS = 100

export {
  DEFAULT_DEEPGRAM_LANGUAGE,
  DEFAULT_DEEPGRAM_MODEL,
  DEFAULT_DEEPGRAM_TIMEOUT_MS,
} from '../../config.js'

export type DeepgramSpeechToTextConfig = Readonly<{
  apiKey: string
  model: string
  timeoutMs: number
  defaultLanguage?: string
  limits: SpeechToTextLimits
}>

export type DeepgramSpeechToTextFactoryConfig = Readonly<{
  apiKey?: string
  model: string
  timeoutMs: number
  defaultLanguage?: string
  limits: SpeechToTextLimits
}>

export type DeepgramTransportRequest = Readonly<{
  url: string
  headers: Readonly<{
    Authorization: string
    'Content-Type': string
  }>
  body: Readonly<Uint8Array>
  signal: AbortSignal
}>

export interface DeepgramTransportResponse {
  readonly status: number
  json(): Promise<unknown>
}

export interface DeepgramTransport {
  post(request: DeepgramTransportRequest): Promise<DeepgramTransportResponse>
}

export class FetchDeepgramTransport implements DeepgramTransport {
  async post(request: DeepgramTransportRequest): Promise<DeepgramTransportResponse> {
    const response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: Buffer.from(request.body),
      signal: request.signal,
    })
    return {
      status: response.status,
      json: () => response.json(),
    }
  }
}

/**
 * Production composition for the optional voice provider.
 *
 * Text-only deployments remain usable without a Deepgram secret. A missing
 * secret produces a typed failure when voice is called; it never invents a
 * transcript or silently falls back to another provider.
 */
export function createSpeechToTextAdapter(
  config: DeepgramSpeechToTextFactoryConfig,
  observability: IObservabilityAdapter,
  transport?: DeepgramTransport,
): ISpeechToTextAdapter {
  if (config.apiKey === undefined || config.apiKey.trim().length === 0) {
    return new UnconfiguredSpeechToTextAdapter()
  }
  return new DeepgramSpeechToTextAdapter(
    { ...config, apiKey: config.apiKey },
    observability,
    transport,
  )
}

export class UnconfiguredSpeechToTextAdapter implements ISpeechToTextAdapter {
  transcribe(
    _input: SpeechToTextInput,
    _options?: SpeechToTextOptions,
  ): Promise<SpeechToTextResult> {
    return Promise.reject(new SpeechToTextError({ code: 'provider_failure', retryable: false }))
  }
}

export class DeepgramSpeechToTextAdapter implements ISpeechToTextAdapter {
  private readonly config: DeepgramSpeechToTextConfig
  private readonly transport: DeepgramTransport

  constructor(
    config: DeepgramSpeechToTextConfig,
    private readonly observability: IObservabilityAdapter,
    transport: DeepgramTransport = new FetchDeepgramTransport(),
  ) {
    validateConfig(config)
    this.config = config
    this.transport = transport
  }

  // eslint-disable-next-line complexity
  async transcribe(
    input: SpeechToTextInput,
    options?: SpeechToTextOptions,
  ): Promise<SpeechToTextResult> {
    const startedAt = Date.now()
    let normalizedInput: SpeechToTextInput | undefined
    let statusCode: number | undefined

    try {
      const execution = await this.executeTranscription(input, options, (status) => {
        statusCode = status
      })
      normalizedInput = execution.input
      this.trace({
        ...(options?.requestId === undefined ? {} : { requestId: options.requestId }),
        input: normalizedInput,
        latencyMs: Date.now() - startedAt,
        outcome: 'success',
        ...(execution.providerDurationMs === undefined
          ? {}
          : { providerDurationMs: execution.providerDurationMs }),
      })
      return execution.result
    } catch (error) {
      const mapped = mapSpeechToTextError(error, options?.signal, 'during_transcription')
      if (normalizedInput === undefined) {
        try {
          normalizedInput = normalizeSpeechToTextInput(input)
        } catch {
          // Invalid input is reported through the typed failure only.
        }
      }
      this.trace({
        ...(options?.requestId === undefined ? {} : { requestId: options.requestId }),
        ...(normalizedInput === undefined ? {} : { input: normalizedInput }),
        latencyMs: Date.now() - startedAt,
        outcome: 'failure',
        failure: mapped.failure,
        ...(statusCode === undefined ? {} : { statusCode }),
      })
      throw mapped
    }
  }

  private async executeTranscription(
    input: SpeechToTextInput,
    options: SpeechToTextOptions | undefined,
    onStatusCode: (statusCode: number) => void,
  ): Promise<{
    input: SpeechToTextInput
    result: SpeechToTextResult
    providerDurationMs?: number
  }> {
    throwIfSpeechToTextCancelled(options?.signal, 'before_transcription')
    const normalizedInput = normalizeSpeechToTextInput(input)
    const timeout = createTimeoutSignal(options?.signal, this.config.timeoutMs)

    try {
      const response = await this.transport.post({
        url: buildDeepgramUrl(this.config, normalizedInput),
        headers: {
          Authorization: `Token ${this.config.apiKey}`,
          'Content-Type': normalizedInput.mediaType,
        },
        body: normalizedInput.audio,
        signal: timeout.signal,
      })
      onStatusCode(response.status)
      ensureSuccessfulStatus(response.status)
      const payload = await readJsonResponse(response)
      const parsed = parseDeepgramResponse(payload, this.config.limits)
      throwIfSpeechToTextCancelled(options?.signal, 'after_transcription')
      return {
        input: normalizedInput,
        result: { kind: 'final', transcript: parsed.transcript },
        ...(parsed.providerDurationMs === undefined
          ? {}
          : { providerDurationMs: parsed.providerDurationMs }),
      }
    } catch (error) {
      throw mapDeepgramError(error, options?.signal, timeout.timedOut())
    } finally {
      timeout.clear()
    }
  }

  private trace(args: {
    requestId?: string
    input?: SpeechToTextInput
    latencyMs: number
    outcome: 'success' | 'failure'
    providerDurationMs?: number
    statusCode?: number
    failure?: SpeechToTextFailure
  }): void {
    const input = args.input
    void this.observability
      .trace({
        requestId: args.requestId ?? crypto.randomUUID(),
        event: args.failure === undefined ? 'speech_to_text' : 'speech_to_text.error',
        ...(input === undefined
          ? {}
          : {
              input: {
                byteCount: input.audio.byteLength,
                ...(input.durationMs === undefined ? {} : { durationMs: input.durationMs }),
              },
            }),
        output: args.failure === undefined ? { kind: 'final' } : { code: args.failure.code },
        latencyMs: args.latencyMs,
        metadata: {
          provider: 'deepgram',
          model: this.config.model,
          outcome: args.outcome,
          ...(args.providerDurationMs === undefined
            ? {}
            : { providerDurationMs: args.providerDurationMs }),
          ...(args.statusCode === undefined ? {} : { statusCode: args.statusCode }),
          ...(args.failure === undefined ? {} : { failureCode: args.failure.code }),
        },
      })
      .catch(() => undefined)
  }
}

function validateConfig(config: DeepgramSpeechToTextConfig): void {
  validateCredentials(config)
  validateModel(config)
  validateTimeout(config)
  validateDefaultLanguage(config)
  validateLimits(config.limits)
}

function validateCredentials(config: DeepgramSpeechToTextConfig): void {
  if (config.apiKey.trim().length === 0) throw new Error('Missing DEEPGRAM_API_KEY.')
}

function validateModel(config: DeepgramSpeechToTextConfig): void {
  if (config.model.trim().length === 0 || config.model.length > MAX_MODEL_CHARACTERS) {
    throw new Error('Invalid DEEPGRAM_MODEL.')
  }
}

function validateTimeout(config: DeepgramSpeechToTextConfig): void {
  if (
    !Number.isInteger(config.timeoutMs) ||
    config.timeoutMs < MIN_TIMEOUT_MS ||
    config.timeoutMs > MAX_TIMEOUT_MS
  ) {
    throw new Error('Invalid DEEPGRAM_TIMEOUT_MS.')
  }
}

function validateDefaultLanguage(config: DeepgramSpeechToTextConfig): void {
  if (config.defaultLanguage === undefined) return
  const normalized = normalizeSpeechToTextLanguage(config.defaultLanguage)
  if (normalized === undefined || normalized === null || normalized !== config.defaultLanguage) {
    throw new Error('Invalid DEEPGRAM_DEFAULT_LANGUAGE.')
  }
}

function validateLimits(limits: SpeechToTextLimits): void {
  if (
    !Number.isInteger(limits.maxDurationMs) ||
    limits.maxDurationMs <= 0 ||
    !Number.isInteger(limits.maxTranscriptCharacters) ||
    limits.maxTranscriptCharacters <= 0
  ) {
    throw new Error('Invalid speech-to-text limits.')
  }
}

function buildDeepgramUrl(config: DeepgramSpeechToTextConfig, input: SpeechToTextInput): string {
  const url = new URL(DEEPGRAM_LISTEN_URL)
  url.searchParams.set('model', config.model)
  const language = input.language ?? config.defaultLanguage
  if (language !== undefined) url.searchParams.set('language', language)
  url.searchParams.set('smart_format', 'true')
  return url.toString()
}

function createTimeoutSignal(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
): {
  signal: AbortSignal
  timedOut: () => boolean
  clear: () => void
} {
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

function ensureSuccessfulStatus(statusCode: number): void {
  if (statusCode < 200 || statusCode >= 300) throw failureForStatus(statusCode)
}

async function readJsonResponse(response: DeepgramTransportResponse): Promise<unknown> {
  try {
    return await response.json()
  } catch (error) {
    const providerError = asRecord(error)
    if (
      providerError !== undefined &&
      (providerError['name'] === 'AbortError' ||
        providerError['name'] === 'TimeoutError' ||
        providerError['code'] === 'ABORT_ERR' ||
        providerError['code'] === 'ETIMEDOUT' ||
        providerError['code'] === 'TIMEOUT')
    ) {
      throw error
    }
    throw malformedResponse()
  }
}

function parseDeepgramResponse(
  payload: unknown,
  limits: SpeechToTextLimits,
): { transcript: string; providerDurationMs?: number } {
  const response = asRecord(payload)
  if (response === undefined) throw malformedResponse()

  validateFinalFlag(response['is_final'])
  const providerDurationMs = parseProviderDuration(response['metadata'], limits)
  const transcript = readTranscript(response['results'])

  return {
    transcript: normalizeFinalTranscript({ kind: 'final', transcript }),
    ...(providerDurationMs === undefined ? {} : { providerDurationMs }),
  }
}

function validateFinalFlag(value: unknown): void {
  if (value !== undefined && typeof value !== 'boolean') throw malformedResponse()
  if (value === false) {
    throw new SpeechToTextError({
      code: 'malformed_transcription',
      reason: 'interim',
      retryable: false,
    })
  }
}

function readTranscript(value: unknown): string {
  const results = asRecord(value)
  const channels = asArray(results?.['channels'])
  const firstChannel = asRecord(channels?.[0])
  const alternatives = asArray(firstChannel?.['alternatives'])
  const firstAlternative = asRecord(alternatives?.[0])
  const transcript = firstAlternative?.['transcript']
  if (typeof transcript !== 'string') throw malformedResponse()
  return transcript
}

function parseProviderDuration(value: unknown, limits: SpeechToTextLimits): number | undefined {
  if (value === undefined) return undefined
  const metadata = asRecord(value)
  if (metadata === undefined) throw malformedResponse()
  const durationSeconds = metadata['duration']
  if (durationSeconds === undefined) return undefined
  if (
    typeof durationSeconds !== 'number' ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds < 0
  ) {
    throw malformedResponse()
  }
  const durationMs = durationSeconds * 1_000
  if (!Number.isFinite(durationMs)) throw malformedResponse()
  if (durationMs > limits.maxDurationMs) {
    throw new SpeechToTextError({
      code: 'audio_too_long',
      actualDurationMs: durationMs,
      maxDurationMs: limits.maxDurationMs,
      retryable: false,
    })
  }
  return durationMs
}

function failureForStatus(statusCode: number): SpeechToTextError {
  if (statusCode === 429) {
    return new SpeechToTextError({ code: 'rate_limited', retryable: true })
  }
  if (statusCode === 408 || statusCode === 504) {
    return new SpeechToTextError({ code: 'timeout', retryable: true })
  }
  if (statusCode >= 400 && statusCode < 500) {
    return new SpeechToTextError({ code: 'provider_rejected', retryable: false })
  }
  return new SpeechToTextError({ code: 'provider_failure', retryable: true })
}

function mapDeepgramError(
  error: unknown,
  callerSignal: AbortSignal | undefined,
  timedOut: boolean,
): SpeechToTextError {
  if (isSpeechToTextError(error)) return error
  if (timedOut) return new SpeechToTextError({ code: 'timeout', retryable: true })
  return mapSpeechToTextError(error, callerSignal, 'during_transcription')
}

function malformedResponse(): SpeechToTextError {
  return new SpeechToTextError({ code: 'malformed_response', retryable: false })
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function asArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined
}

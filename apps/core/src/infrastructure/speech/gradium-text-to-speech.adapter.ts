import crypto from 'node:crypto'
import type { IObservabilityAdapter } from '../../application/ports/IObservabilityAdapter.js'
import {
  isTextToSpeechError,
  normalizeTextToSpeechInput,
  TextToSpeechError,
  throwIfTextToSpeechCancelled,
  type ITextToSpeechAdapter,
  type TextToSpeechInput,
  type TextToSpeechLimits,
  type TextToSpeechOptions,
  type TextToSpeechStream,
  type VoiceListFilter,
} from '../../application/ports/ITextToSpeechAdapter.js'
import type { AudioOutputFormat, VoiceOption } from '@gami/shared'
import { GradiumVoiceCatalog, type GradiumVoiceListTransport } from './gradium-voice-catalog.js'
import {
  cancelResponseBody,
  failureForStatus,
  settleAudioStream,
  streamAudioResponse,
  TimeoutMarker,
  type AudioStreamOutcome,
} from './audio-response.js'
import { createTimeoutSignal, type TimeoutSignal } from './timeout-signal.js'

export const DEFAULT_GRADIUM_BASE_URL = 'https://api.gradium.ai/api'
export const DEFAULT_GRADIUM_TIMEOUT_MS = 30_000
const MIN_TIMEOUT_MS = 100
const MAX_TIMEOUT_MS = 120_000
const MAX_BASE_URL_CHARACTERS = 500

export type GradiumTextToSpeechConfig = Readonly<{
  apiKey: string
  /** REST base, e.g. `https://api.gradium.ai/api`; TTS and voice routes hang off it. */
  baseUrl: string
  timeoutMs: number
  limits: TextToSpeechLimits
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

export class GradiumTextToSpeechAdapter implements ITextToSpeechAdapter {
  readonly provider = 'gradium' as const
  private readonly config: GradiumTextToSpeechConfig
  private readonly transport: GradiumTransport
  private readonly voiceCatalog: GradiumVoiceCatalog

  constructor(
    config: GradiumTextToSpeechConfig,
    private readonly observability: IObservabilityAdapter,
    transport: GradiumTransport = new FetchGradiumTransport(),
    voiceListTransport?: GradiumVoiceListTransport,
  ) {
    validateConfig(config)
    this.config = config
    this.transport = transport
    this.voiceCatalog = new GradiumVoiceCatalog(config, voiceListTransport)
  }

  listVoices(filter?: VoiceListFilter): Promise<VoiceOption[]> {
    return this.voiceCatalog.list(filter?.language)
  }

  getDefaultVoiceId(language?: string): Promise<string | undefined> {
    return this.voiceCatalog.getDefaultVoiceId(language)
  }

  async synthesize(
    input: TextToSpeechInput,
    options?: TextToSpeechOptions,
  ): Promise<TextToSpeechStream> {
    const startedAt = Date.now()
    let requestId: string | undefined
    let format: AudioOutputFormat | undefined
    let statusCode: number | undefined
    let timeout: TimeoutSignal | undefined
    const settle = (outcome: AudioStreamOutcome): void => {
      timeout?.clear()
      this.trace({
        ...(requestId === undefined ? {} : { requestId }),
        ...(format === undefined ? {} : { format }),
        latencyMs: Date.now() - startedAt,
        outcome,
        ...(statusCode === undefined ? {} : { statusCode }),
      })
    }
    const mapError = (error: unknown): TextToSpeechError =>
      mapGradiumError(
        error,
        options?.signal,
        error instanceof TimeoutMarker || timeout?.timedOut() === true,
      )

    try {
      throwIfTextToSpeechCancelled(options?.signal, 'before_synthesis')
      const normalized = normalizeTextToSpeechInput(input)
      requestId = normalized.requestId
      format = normalized.format
      const providerFormat = mapOutputFormat(normalized.format)
      timeout = createTimeoutSignal(options?.signal, this.config.timeoutMs)
      const response = await this.transport.post({
        url: `${this.config.baseUrl}/post/speech/tts`,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
        },
        body: JSON.stringify({
          text: normalized.text,
          voice_id: normalized.voiceId,
          output_format: providerFormat,
          only_audio: true,
        }),
        signal: timeout.signal,
      })
      statusCode = response.status
      if (response.status < 200 || response.status >= 300) {
        await cancelResponseBody(response)
        throw failureForStatus(response.status)
      }
      const chunks = await streamAudioResponse(
        response,
        normalized.format,
        this.config.limits,
        timeout.signal,
        options?.signal,
      )
      return {
        audio: settleAudioStream(chunks, mapError, settle),
        metadata: {
          requestId: normalized.requestId,
          messageId: normalized.messageId,
          format: normalized.format,
        },
      }
    } catch (error) {
      const mapped = mapError(error)
      settle({ failure: mapped.failure })
      throw mapped
    }
  }

  private trace(args: {
    requestId?: string
    format?: AudioOutputFormat
    latencyMs: number
    outcome: AudioStreamOutcome
    statusCode?: number
  }): void {
    const { failure } = args.outcome
    const success =
      failure === undefined
        ? {
            byteCount: args.outcome.byteCount,
            ...(args.format === undefined ? {} : { format: args.format }),
          }
        : undefined
    void this.observability
      .trace({
        requestId: args.requestId ?? crypto.randomUUID(),
        event: failure === undefined ? 'text_to_speech' : 'text_to_speech.error',
        output: success ?? { code: failure?.code },
        latencyMs: args.latencyMs,
        metadata: {
          provider: 'gradium',
          outcome: failure === undefined ? 'success' : 'failure',
          ...success,
          ...(args.statusCode === undefined ? {} : { statusCode: args.statusCode }),
          ...(failure === undefined ? {} : { failureCode: failure.code }),
        },
      })
      .catch(() => undefined)
  }
}

// eslint-disable-next-line complexity -- retained non-linear boundary mapping is clearer together
function validateConfig(config: GradiumTextToSpeechConfig): void {
  if (config.apiKey.trim().length === 0) {
    throw new Error('Missing GRADIUM_API_KEY.')
  }
  if (
    config.baseUrl.trim().length === 0 ||
    config.baseUrl.length > MAX_BASE_URL_CHARACTERS ||
    !isHttpUrl(config.baseUrl)
  ) {
    throw new Error('Invalid GRADIUM_BASE_URL.')
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
}

function mapOutputFormat(format: AudioOutputFormat): 'wav' | 'opus' | 'pcm_24000' {
  if (format === 'audio/wav') return 'wav'
  if (format === 'audio/ogg') return 'opus'
  if (format === 'audio/pcm') return 'pcm_24000'
  throw new TextToSpeechError({ code: 'unsupported_format', format, retryable: false })
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

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

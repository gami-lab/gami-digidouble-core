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
  type VoiceListFilter,
} from '../../application/ports/ITextToSpeechAdapter.js'
import type { AudioOutputFormat, VoiceOption } from '@gami/shared'
import { GradiumVoiceCatalog, type GradiumVoiceListTransport } from './gradium-voice-catalog.js'
import {
  cancelResponseBody,
  failureForStatus,
  readAudioResponse,
  TimeoutMarker,
} from './audio-response.js'
import { createTimeoutSignal } from './timeout-signal.js'

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
    const providerFormat = mapOutputFormat(normalizedInput.format)
    const timeout = createTimeoutSignal(options?.signal, this.config.timeoutMs)

    try {
      const response = await this.transport.post({
        url: `${this.config.baseUrl}/post/speech/tts`,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
        },
        body: JSON.stringify({
          text: normalizedInput.text,
          voice_id: normalizedInput.voiceId,
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
      if (timeout.timedOut()) throw new TimeoutMarker()
      throwIfTextToSpeechCancelled(options?.signal, 'during_synthesis')
      const audio = await readAudioResponse(
        response,
        normalizedInput.format,
        this.config.limits,
        timeout.signal,
        options?.signal,
      )
      if (timeout.timedOut()) throw new TimeoutMarker()
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
                ...(args.result.metadata.durationMs === undefined
                  ? {}
                  : { durationMs: args.result.metadata.durationMs }),
              },
            }),
        ...(args.failure === undefined ? {} : { output: { code: args.failure.code } }),
        latencyMs: args.latencyMs,
        metadata: {
          provider: 'gradium',
          outcome: args.outcome,
          ...(args.result === undefined
            ? {}
            : {
                byteCount: args.result.metadata.byteLength,
                format: args.result.metadata.format,
                ...(args.result.metadata.durationMs === undefined
                  ? {}
                  : { durationMs: args.result.metadata.durationMs }),
              }),
          ...(args.statusCode === undefined ? {} : { statusCode: args.statusCode }),
          ...(args.failure === undefined ? {} : { failureCode: args.failure.code }),
        },
      })
      .catch(() => undefined)
  }
}

// eslint-disable-next-line complexity
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

function mapOutputFormat(format: AudioOutputFormat): 'wav' | 'opus' {
  if (format === 'audio/wav') return 'wav'
  if (format === 'audio/ogg') return 'opus'
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

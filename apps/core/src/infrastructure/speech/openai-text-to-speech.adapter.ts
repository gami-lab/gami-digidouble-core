import crypto from 'node:crypto'
import OpenAI from 'openai'
import { isAudioOutputFormat, type AudioOutputFormat, type VoiceOption } from '@gami/shared'
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
} from '../../application/ports/ITextToSpeechAdapter.js'
import {
  failureForStatus,
  settleAudioStream,
  streamAudioResponse,
  TimeoutMarker,
  type AudioStreamOutcome,
} from './audio-response.js'
import { createTimeoutSignal, type TimeoutSignal } from './timeout-signal.js'

export const DEFAULT_OPENAI_TTS_MODEL = 'gpt-4o-mini-tts'
export const DEFAULT_OPENAI_TTS_TIMEOUT_MS = 30_000
/** OpenAI rejects longer speech input. */
const OPENAI_MAX_INPUT_CHARACTERS = 4096

/** Built-in voices; each speaks every supported language, so none is language-tagged. */
const OPENAI_VOICE_IDS = [
  'alloy',
  'ash',
  'ballad',
  'cedar',
  'coral',
  'echo',
  'fable',
  'marin',
  'nova',
  'onyx',
  'sage',
  'shimmer',
  'verse',
] as const
const OPENAI_DEFAULT_VOICE_ID = 'marin'
const OPENAI_VOICES: readonly VoiceOption[] = OPENAI_VOICE_IDS.map((voiceId) => ({
  voiceId,
  name: voiceId.charAt(0).toUpperCase() + voiceId.slice(1),
}))

export type OpenAiTextToSpeechConfig = Readonly<{
  apiKey: string
  model: string
  timeoutMs: number
  limits: TextToSpeechLimits
}>

type OpenAiSpeechFormat = 'wav' | 'opus' | 'mp3' | 'pcm'

/** The slice of the OpenAI SDK this adapter uses; the response is the raw HTTP audio response. */
export interface OpenAiSpeechClient {
  audio: {
    speech: {
      create(
        body: { model: string; voice: string; input: string; response_format: OpenAiSpeechFormat },
        options: { signal: AbortSignal },
      ): Promise<Pick<Response, 'headers' | 'body'>>
    }
  }
}

export class OpenAiTextToSpeechAdapter implements ITextToSpeechAdapter {
  readonly provider = 'openai' as const
  private readonly client: OpenAiSpeechClient

  constructor(
    private readonly config: OpenAiTextToSpeechConfig,
    private readonly observability: IObservabilityAdapter,
    client?: OpenAiSpeechClient,
  ) {
    if (config.apiKey.trim().length === 0) throw new Error('Missing OPENAI_API_KEY.')
    this.client =
      client ?? new OpenAI({ apiKey: config.apiKey, timeout: config.timeoutMs, maxRetries: 0 })
  }

  listVoices(): Promise<VoiceOption[]> {
    return Promise.resolve(OPENAI_VOICES.map((voice) => ({ ...voice })))
  }

  getDefaultVoiceId(): Promise<string | undefined> {
    return Promise.resolve(OPENAI_DEFAULT_VOICE_ID)
  }

  async synthesize(
    input: TextToSpeechInput,
    options?: TextToSpeechOptions,
  ): Promise<TextToSpeechStream> {
    const startedAt = Date.now()
    let timeout: TimeoutSignal | undefined
    const settle = (outcome: AudioStreamOutcome): void => {
      timeout?.clear()
      this.trace(input.requestId, input.format, Date.now() - startedAt, outcome)
    }
    const mapError = (error: unknown): TextToSpeechError => mapOpenAiError(error, options?.signal)

    try {
      throwIfTextToSpeechCancelled(options?.signal, 'before_synthesis')
      const normalized = normalizeTextToSpeechInput(input)
      if (normalized.text.length > OPENAI_MAX_INPUT_CHARACTERS) {
        throw new TextToSpeechError({
          code: 'invalid_request',
          reason: 'text_too_long',
          retryable: false,
        })
      }
      const responseFormat = mapOutputFormat(normalized.format)
      timeout = createTimeoutSignal(options?.signal, this.config.timeoutMs)
      const signal = timeout.signal
      const response = await this.client.audio.speech
        .create(
          {
            model: this.config.model,
            voice: normalized.voiceId,
            input: normalized.text,
            response_format: responseFormat,
          },
          { signal },
        )
        .catch((error: unknown) => {
          throw signal.aborted && timeout?.timedOut() === true ? new TimeoutMarker() : error
        })
      const chunks = await streamAudioResponse(
        response,
        normalized.format,
        this.config.limits,
        signal,
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

  private trace(
    requestId: unknown,
    format: unknown,
    latencyMs: number,
    outcome: AudioStreamOutcome,
  ): void {
    const { failure } = outcome
    const success =
      failure === undefined
        ? { byteCount: outcome.byteCount, ...(isAudioOutputFormat(format) ? { format } : {}) }
        : undefined
    void this.observability
      .trace({
        requestId: typeof requestId === 'string' ? requestId : crypto.randomUUID(),
        event: failure === undefined ? 'text_to_speech' : 'text_to_speech.error',
        output: success ?? { code: failure?.code },
        latencyMs,
        metadata: {
          provider: 'openai',
          model: this.config.model,
          outcome: failure === undefined ? 'success' : 'failure',
          ...success,
          ...(failure === undefined ? {} : { failureCode: failure.code }),
        },
      })
      .catch(() => undefined)
  }
}

function mapOutputFormat(format: AudioOutputFormat): OpenAiSpeechFormat {
  if (format === 'audio/wav') return 'wav'
  if (format === 'audio/ogg') return 'opus'
  if (format === 'audio/mpeg') return 'mp3'
  if (format === 'audio/pcm') return 'pcm'
  throw new TextToSpeechError({ code: 'unsupported_format', format, retryable: false })
}

function mapOpenAiError(error: unknown, callerSignal: AbortSignal | undefined): TextToSpeechError {
  if (isTextToSpeechError(error)) return error
  if (callerSignal?.aborted === true) {
    return new TextToSpeechError({ code: 'cancelled', phase: 'during_synthesis', retryable: false })
  }
  if (error instanceof TimeoutMarker || error instanceof OpenAI.APIConnectionTimeoutError) {
    return new TextToSpeechError({ code: 'timeout', retryable: true })
  }
  const status: unknown = error instanceof OpenAI.APIError ? error.status : undefined
  if (typeof status === 'number') return failureForStatus(status)
  return new TextToSpeechError({ code: 'provider_unavailable', retryable: true })
}

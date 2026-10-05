import crypto from 'node:crypto'
import OpenAI from 'openai'
import type { AudioOutputFormat, VoiceOption } from '@gami/shared'
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
} from '../../application/ports/ITextToSpeechAdapter.js'
import { failureForStatus, readAudioResponse, TimeoutMarker } from './audio-response.js'
import { createTimeoutSignal } from './timeout-signal.js'

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

type OpenAiSpeechFormat = 'wav' | 'opus' | 'mp3'

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
  ): Promise<TextToSpeechResult> {
    const startedAt = Date.now()
    try {
      const result = await this.executeSynthesis(input, options)
      this.trace(result.metadata.requestId, Date.now() - startedAt, { result })
      return result
    } catch (error) {
      const mapped = mapOpenAiError(error, options?.signal)
      this.trace(input.requestId, Date.now() - startedAt, { failure: mapped.failure })
      throw mapped
    }
  }

  private async executeSynthesis(
    input: TextToSpeechInput,
    options: TextToSpeechOptions | undefined,
  ): Promise<TextToSpeechResult> {
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
    const timeout = createTimeoutSignal(options?.signal, this.config.timeoutMs)

    try {
      const response = await this.client.audio.speech.create(
        {
          model: this.config.model,
          voice: normalized.voiceId,
          input: normalized.text,
          response_format: responseFormat,
        },
        { signal: timeout.signal },
      )
      throwIfTextToSpeechCancelled(options?.signal, 'during_synthesis')
      const audio = await readAudioResponse(
        response,
        normalized.format,
        this.config.limits,
        timeout.signal,
        options?.signal,
      )
      throwIfTextToSpeechCancelled(options?.signal, 'after_synthesis')
      return {
        audio,
        metadata: {
          requestId: normalized.requestId,
          messageId: normalized.messageId,
          format: normalized.format,
          byteLength: audio.byteLength,
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

  private trace(
    requestId: string | undefined,
    latencyMs: number,
    outcome: { result?: TextToSpeechResult; failure?: TextToSpeechFailure },
  ): void {
    const metadata = outcome.result?.metadata
    void this.observability
      .trace({
        requestId: typeof requestId === 'string' ? requestId : crypto.randomUUID(),
        event: outcome.failure === undefined ? 'text_to_speech' : 'text_to_speech.error',
        ...(metadata === undefined
          ? {}
          : { output: { byteCount: metadata.byteLength, format: metadata.format } }),
        ...(outcome.failure === undefined ? {} : { output: { code: outcome.failure.code } }),
        latencyMs,
        metadata: {
          provider: 'openai',
          model: this.config.model,
          outcome: outcome.failure === undefined ? 'success' : 'failure',
          ...(metadata === undefined
            ? {}
            : { byteCount: metadata.byteLength, format: metadata.format }),
          ...(outcome.failure === undefined ? {} : { failureCode: outcome.failure.code }),
        },
      })
      .catch(() => undefined)
  }
}

function mapOutputFormat(format: AudioOutputFormat): OpenAiSpeechFormat {
  if (format === 'audio/wav') return 'wav'
  if (format === 'audio/ogg') return 'opus'
  if (format === 'audio/mpeg') return 'mp3'
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

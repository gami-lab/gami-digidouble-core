import { describe, expect, it, vi } from 'vitest'
import {
  normalizeSpeechToTextInput,
  SPEECH_TO_TEXT_LIMITS,
  type SpeechToTextInput,
} from '../../application/ports/ISpeechToTextAdapter.js'
import type {
  IObservabilityAdapter,
  TraceEvent,
} from '../../application/ports/IObservabilityAdapter.js'
import {
  createSpeechToTextAdapter,
  DeepgramSpeechToTextAdapter,
  type DeepgramTransport,
  type DeepgramTransportRequest,
  type DeepgramTransportResponse,
} from './deepgram-speech-to-text.adapter.js'

const limits = SPEECH_TO_TEXT_LIMITS

function createObservability(): {
  adapter: IObservabilityAdapter
  trace: ReturnType<typeof vi.fn>
} {
  const trace = vi.fn<(event: TraceEvent) => Promise<void>>().mockResolvedValue(undefined)
  return {
    trace,
    adapter: { trace, flush: vi.fn().mockResolvedValue(undefined) },
  }
}

function createInput(overrides: Record<string, unknown> = {}): SpeechToTextInput {
  return normalizeSpeechToTextInput({
    conversationId: 'conversation-1',
    utteranceId: 'utterance-1',
    audio: Uint8Array.from([1, 2, 3]),
    mediaType: 'audio/webm',
    durationMs: 1_500,
    ...overrides,
  })
}

function createResponse(payload: unknown, status = 200): DeepgramTransportResponse {
  return { status, json: vi.fn().mockResolvedValue(payload) }
}

function createAdapter(
  payload: unknown,
  options: {
    defaultLanguage?: string
    timeoutMs?: number
    status?: number
  } = {},
): {
  adapter: DeepgramSpeechToTextAdapter
  post: ReturnType<typeof vi.fn>
  trace: ReturnType<typeof vi.fn>
} {
  const observability = createObservability()
  const post = vi
    .fn<DeepgramTransport['post']>()
    .mockResolvedValue(createResponse(payload, options.status))
  return {
    adapter: new DeepgramSpeechToTextAdapter(
      {
        apiKey: 'dg-secret-test',
        model: 'nova-3',
        timeoutMs: options.timeoutMs ?? 30_000,
        ...(options.defaultLanguage === undefined
          ? { defaultLanguage: 'en' }
          : { defaultLanguage: options.defaultLanguage }),
        limits,
      },
      observability.adapter,
      { post } satisfies DeepgramTransport,
    ),
    post,
    trace: observability.trace,
  }
}

const finalPayload = {
  metadata: { duration: 1.25 },
  results: {
    channels: [{ alternatives: [{ transcript: '  hello world  ' }] }],
  },
}

describe('DeepgramSpeechToTextAdapter', () => {
  it('constructs the bounded prerecorded request with provider-only fields', async () => {
    const { adapter, post } = createAdapter(finalPayload)

    await expect(adapter.transcribe(createInput({ language: 'fr-FR' }))).resolves.toEqual({
      kind: 'final',
      transcript: 'hello world',
    })

    expect(post).toHaveBeenCalledTimes(1)
    const request = post.mock.calls[0]?.[0] as DeepgramTransportRequest
    expect(request.url).toBe(
      'https://api.deepgram.com/v1/listen?model=nova-3&language=fr-FR&smart_format=true',
    )
    expect(request.headers).toEqual({
      Authorization: 'Token dg-secret-test',
      'Content-Type': 'audio/webm',
    })
    expect(request.body).toEqual(Uint8Array.from([1, 2, 3]))
    expect(request.signal.aborted).toBe(false)
  })

  it('uses the configured default language when the caller omits one', async () => {
    const { adapter, post } = createAdapter(finalPayload, { defaultLanguage: 'de-DE' })

    await adapter.transcribe(createInput({ language: undefined }))

    expect((post.mock.calls[0]?.[0] as DeepgramTransportRequest).url).toContain('language=de-DE')
  })

  it('accepts a completed response only as a final application result', async () => {
    const { adapter, trace } = createAdapter(finalPayload)

    await expect(adapter.transcribe(createInput())).resolves.toEqual({
      kind: 'final',
      transcript: 'hello world',
    })
    const event = trace.mock.calls[0]?.[0] as
      | {
          event: string
          output: { kind: string }
          input: { byteCount: number; durationMs: number }
          metadata: Record<string, unknown>
        }
      | undefined
    expect(event).toMatchObject({
      event: 'speech_to_text',
      output: { kind: 'final' },
      input: { byteCount: 3, durationMs: 1_500 },
      metadata: {
        provider: 'deepgram',
        model: 'nova-3',
        providerDurationMs: 1_250,
        outcome: 'success',
      },
    })
  })

  it('uses an application request ID for correlated provider observability', async () => {
    const { adapter, trace } = createAdapter(finalPayload)

    await adapter.transcribe(createInput(), { requestId: 'voice-request-1' })

    expect(trace).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'voice-request-1' }))
  })
})

describe('DeepgramSpeechToTextAdapter response failures', () => {
  it.each([
    [
      'empty transcript',
      { results: { channels: [{ alternatives: [{ transcript: '  ' }] }] } },
      'malformed_transcription',
    ],
    [
      'non-final response',
      { is_final: false, results: { channels: [] } },
      'malformed_transcription',
    ],
    ['malformed response', { results: { channels: [] } }, 'malformed_response'],
  ] as const)('rejects %s without returning a user message', async (_label, payload, code) => {
    const { adapter } = createAdapter(payload)

    await expect(adapter.transcribe(createInput())).rejects.toMatchObject({
      failure: { code },
    })
  })

  it('rejects provider duration and transcript over the shared limits', async () => {
    const duration = createAdapter({
      metadata: { duration: 121 },
      results: { channels: [{ alternatives: [{ transcript: 'hello' }] }] },
    })
    await expect(duration.adapter.transcribe(createInput())).rejects.toMatchObject({
      failure: { code: 'audio_too_long' },
    })

    const transcript = createAdapter({
      results: {
        channels: [
          { alternatives: [{ transcript: 'a'.repeat(limits.maxTranscriptCharacters + 1) }] },
        ],
      },
    })
    await expect(transcript.adapter.transcribe(createInput())).rejects.toMatchObject({
      failure: { code: 'transcript_too_long' },
    })
  })
})

describe('DeepgramSpeechToTextAdapter transport failures', () => {
  it.each([
    [401, 'provider_rejected'],
    [429, 'rate_limited'],
    [500, 'provider_failure'],
    [504, 'timeout'],
  ] as const)('maps HTTP %s to %s without parsing provider payloads', async (status, code) => {
    const { adapter, post } = createAdapter({ secret: 'provider payload' }, { status })

    await expect(adapter.transcribe(createInput())).rejects.toMatchObject({ failure: { code } })
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('propagates caller cancellation to the transport and maps it safely', async () => {
    const observability = createObservability()
    let request: DeepgramTransportRequest | undefined
    const post = vi.fn((candidate: DeepgramTransportRequest) => {
      request = candidate
      return new Promise<DeepgramTransportResponse>((_resolve, reject) => {
        candidate.signal.addEventListener('abort', () => {
          reject(Object.assign(new Error('cancelled provider request'), { name: 'AbortError' }))
        })
      })
    })
    const adapter = new DeepgramSpeechToTextAdapter(
      { apiKey: 'dg-secret-test', model: 'nova-3', timeoutMs: 30_000, limits },
      observability.adapter,
      { post } satisfies DeepgramTransport,
    )
    const controller = new AbortController()
    const transcription = adapter.transcribe(createInput(), { signal: controller.signal })
    controller.abort()

    await expect(transcription).rejects.toMatchObject({
      failure: { code: 'cancelled' },
    })
    expect(request?.signal.aborted).toBe(true)
  })

  it('maps an adapter timeout to a typed timeout failure', async () => {
    vi.useFakeTimers()
    try {
      const observability = createObservability()
      const post = vi.fn(
        (request: DeepgramTransportRequest) =>
          new Promise<DeepgramTransportResponse>((_resolve, reject) => {
            request.signal.addEventListener('abort', () => {
              reject(Object.assign(new Error('timeout'), { name: 'AbortError' }))
            })
          }),
      )
      const adapter = new DeepgramSpeechToTextAdapter(
        { apiKey: 'dg-secret-test', model: 'nova-3', timeoutMs: 100, limits },
        observability.adapter,
        { post } satisfies DeepgramTransport,
      )
      const transcription = adapter.transcribe(createInput())
      const failure = expect(transcription).rejects.toMatchObject({
        failure: { code: 'timeout' },
      })
      await vi.advanceTimersByTimeAsync(100)

      await failure
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('DeepgramSpeechToTextAdapter cancellation', () => {
  it('rejects cancellation detected after the provider response', async () => {
    const controller = new AbortController()
    const observability = createObservability()
    const post = vi.fn().mockResolvedValue({
      status: 200,
      json: vi.fn().mockImplementation(() => {
        controller.abort()
        return Promise.resolve(finalPayload)
      }),
    } satisfies DeepgramTransportResponse)
    const adapter = new DeepgramSpeechToTextAdapter(
      { apiKey: 'dg-secret-test', model: 'nova-3', timeoutMs: 30_000, limits },
      observability.adapter,
      { post } satisfies DeepgramTransport,
    )

    await expect(
      adapter.transcribe(createInput(), { signal: controller.signal }),
    ).rejects.toMatchObject({
      failure: { code: 'cancelled', phase: 'after_transcription' },
    })
  })
})

describe('DeepgramSpeechToTextAdapter safety', () => {
  it('does not leak credentials, audio, transcript, or provider payloads to observability', async () => {
    const { adapter, trace } = createAdapter(finalPayload)
    await adapter.transcribe(createInput())

    const serialized = JSON.stringify(trace.mock.calls[0]?.[0])
    expect(serialized).not.toContain('dg-secret-test')
    expect(serialized).not.toContain('hello world')
    expect(serialized).not.toContain('1,2,3')
    expect(serialized).not.toContain('provider payload')
  })

  it('records bounded failure metadata without provider response details', async () => {
    const { adapter, trace } = createAdapter(
      { secret: 'provider payload dg-secret-test hello world' },
      { status: 500 },
    )

    await expect(
      adapter.transcribe(createInput(), { requestId: 'voice-request-1' }),
    ).rejects.toMatchObject({
      failure: { code: 'provider_failure' },
    })

    const event = trace.mock.calls[0]?.[0] as TraceEvent | undefined
    const serialized = JSON.stringify(event)
    expect(event).toMatchObject({
      requestId: 'voice-request-1',
      input: { byteCount: 3, durationMs: 1_500 },
      event: 'speech_to_text.error',
      output: { code: 'provider_failure' },
      metadata: {
        outcome: 'failure',
        failureCode: 'provider_failure',
        statusCode: 500,
      },
    })
    expect(event?.latencyMs).toEqual(expect.any(Number))
    expect(serialized).not.toContain('dg-secret-test')
    expect(serialized).not.toContain('provider payload')
    expect(serialized).not.toContain('hello world')
    expect(serialized).not.toContain('1,2,3')
  })

  it('keeps voice unconfigured without changing existing provider composition', async () => {
    const adapter = createSpeechToTextAdapter(
      {
        model: 'nova-3',
        timeoutMs: 30_000,
        limits,
      },
      createObservability().adapter,
    )

    await expect(adapter.transcribe(createInput())).rejects.toMatchObject({
      failure: { code: 'provider_failure', retryable: false },
    })
  })
})

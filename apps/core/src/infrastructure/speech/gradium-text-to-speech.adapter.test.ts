import { describe, expect, it, vi } from 'vitest'
import type {
  IObservabilityAdapter,
  TraceEvent,
} from '../../application/ports/IObservabilityAdapter.js'
import {
  TextToSpeechError,
  TEXT_TO_SPEECH_LIMITS,
  type TextToSpeechInput,
} from '../../application/ports/ITextToSpeechAdapter.js'
import {
  createTextToSpeechAdapter,
  GradiumTextToSpeechAdapter,
  type GradiumTransport,
  type GradiumTransportRequest,
  type GradiumTransportResponse,
} from './gradium-text-to-speech.adapter.js'

function createObservability(): {
  adapter: IObservabilityAdapter
  trace: ReturnType<typeof vi.fn>
} {
  const trace = vi.fn<(event: TraceEvent) => Promise<void>>().mockResolvedValue(undefined)
  return { trace, adapter: { trace, flush: vi.fn().mockResolvedValue(undefined) } }
}

function createInput(overrides: Partial<TextToSpeechInput> = {}): TextToSpeechInput {
  return {
    text: 'Hello from the avatar.',
    voice: { voiceKey: 'avatar-default', language: 'en-US' },
    format: 'audio/wav',
    requestId: 'request-1',
    messageId: 'message-1',
    ...overrides,
  }
}

function createResponse(
  bytes: Uint8Array,
  options: {
    status?: number
    contentType?: string
    declaredLength?: string
    chunks?: Uint8Array[]
    closeBody?: boolean
  } = {},
): GradiumTransportResponse & {
  arrayBuffer: ReturnType<typeof vi.fn>
  cancelled: () => boolean
} {
  let cancelled = false
  const chunks = options.chunks ?? [bytes]
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      if (options.closeBody !== false) controller.close()
    },
    cancel() {
      cancelled = true
    },
  })
  const headers = new Headers()
  if (options.contentType !== undefined) headers.set('content-type', options.contentType)
  if (options.declaredLength !== undefined) headers.set('content-length', options.declaredLength)
  return {
    status: options.status ?? 200,
    headers,
    body,
    arrayBuffer: vi.fn().mockResolvedValue(bytes.buffer),
    cancelled: () => cancelled,
  }
}

function createAdapter(
  response: GradiumTransportResponse,
  options: { timeoutMs?: number; maxOutputBytes?: number } = {},
): {
  adapter: GradiumTextToSpeechAdapter
  post: ReturnType<typeof vi.fn>
  trace: ReturnType<typeof vi.fn>
} {
  const observability = createObservability()
  const post = vi.fn<GradiumTransport['post']>().mockResolvedValue(response)
  return {
    adapter: new GradiumTextToSpeechAdapter(
      {
        apiKey: 'gradium-secret-test',
        endpoint: 'https://gradium.test/api/post/speech/tts',
        timeoutMs: options.timeoutMs ?? 30_000,
        limits: {
          ...TEXT_TO_SPEECH_LIMITS,
          ...(options.maxOutputBytes === undefined
            ? {}
            : { maxOutputBytes: options.maxOutputBytes }),
        },
        voiceMap: { 'avatar-default': 'provider-voice-123' },
      },
      observability.adapter,
      { post } satisfies GradiumTransport,
    ),
    post,
    trace: observability.trace,
  }
}

// eslint-disable-next-line max-lines-per-function
describe('GradiumTextToSpeechAdapter', () => {
  it('maps the provider-neutral request to the official Gradium JSON fields', async () => {
    const response = createResponse(Uint8Array.from([1, 2, 3]), {
      contentType: 'audio/wav',
      declaredLength: '3',
    })
    const { adapter, post } = createAdapter(response)

    await expect(adapter.synthesize(createInput())).resolves.toEqual({
      audio: Uint8Array.from([1, 2, 3]),
      metadata: {
        requestId: 'request-1',
        messageId: 'message-1',
        format: 'audio/wav',
        byteLength: 3,
      },
    })

    const request = post.mock.calls[0]?.[0] as GradiumTransportRequest
    expect(request.url).toBe('https://gradium.test/api/post/speech/tts')
    expect(request.headers).toEqual({
      'Content-Type': 'application/json',
      'x-api-key': 'gradium-secret-test',
    })
    expect(JSON.parse(request.body) as unknown).toEqual({
      text: 'Hello from the avatar.',
      voice_id: 'provider-voice-123',
      output_format: 'wav',
      only_audio: true,
    })
    expect(request.signal.aborted).toBe(false)
  })

  it('maps Ogg delivery to Gradium Opus without exposing provider fields upstream', async () => {
    const { adapter, post } = createAdapter(
      createResponse(Uint8Array.from([4, 5]), { contentType: 'audio/ogg', declaredLength: '2' }),
    )

    await adapter.synthesize(createInput({ format: 'audio/ogg' }))

    expect(
      JSON.parse((post.mock.calls[0]?.[0] as GradiumTransportRequest).body) as unknown,
    ).toEqual(expect.objectContaining({ output_format: 'opus' }))
  })

  it.each([
    [400, 'provider_unavailable'],
    [401, 'invalid_configuration'],
    [429, 'rate_limited'],
    [500, 'provider_unavailable'],
    [504, 'timeout'],
  ] as const)('maps HTTP %s to %s without reading provider payloads', async (status, code) => {
    const response = createResponse(Uint8Array.from([1]), {
      status,
      contentType: 'application/json',
    })
    const { adapter } = createAdapter(response)

    await expect(adapter.synthesize(createInput())).rejects.toMatchObject({ failure: { code } })
    expect(response.cancelled()).toBe(true)
  })

  it('rejects missing logical voice mappings as invalid configuration', async () => {
    const { adapter, post } = createAdapter(
      createResponse(Uint8Array.from([1]), { contentType: 'audio/wav' }),
    )

    await expect(
      adapter.synthesize(createInput({ voice: { voiceKey: 'unknown' } })),
    ).rejects.toMatchObject({
      failure: { code: 'invalid_configuration', reason: 'missing_voice_mapping' },
    })
    expect(post).not.toHaveBeenCalled()
  })

  it('rejects unsupported browser formats before making a provider request', async () => {
    const { adapter, post } = createAdapter(
      createResponse(Uint8Array.from([1]), { contentType: 'audio/wav' }),
    )

    await expect(adapter.synthesize(createInput({ format: 'audio/webm' }))).rejects.toMatchObject({
      failure: { code: 'unsupported_format', format: 'audio/webm' },
    })
    expect(post).not.toHaveBeenCalled()
  })

  it.each([
    ['missing content type', {}, 'invalid_content_type'],
    ['empty body', { contentType: 'audio/wav' }, 'empty'],
    [
      'declared size mismatch',
      { contentType: 'audio/wav', declaredLength: '4' },
      'declared_size_mismatch',
    ],
  ] as const)('rejects %s as invalid provider output', async (_label, responseOptions, reason) => {
    const response = createResponse(
      _label === 'empty body' ? new Uint8Array() : Uint8Array.from([1, 2, 3]),
      responseOptions,
    )
    const { adapter } = createAdapter(response)

    await expect(adapter.synthesize(createInput())).rejects.toMatchObject({
      failure: { code: 'invalid_provider_output', reason },
    })
  })

  it('bounds streamed output and cancels the provider body on overflow', async () => {
    const response = createResponse(Uint8Array.from([1, 2, 3, 4]), {
      contentType: 'audio/wav',
      chunks: [Uint8Array.from([1, 2]), Uint8Array.from([3, 4])],
      closeBody: false,
    })
    const { adapter } = createAdapter(response, { maxOutputBytes: 3 })

    await expect(adapter.synthesize(createInput())).rejects.toMatchObject({
      failure: { code: 'invalid_provider_output', reason: 'oversized' },
    })
    expect(response.cancelled()).toBe(true)
  })

  it('rejects a malformed streamed body and cancels it', async () => {
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue('not audio' as unknown as Uint8Array)
      },
      cancel() {
        cancelled = true
      },
    })
    const response: GradiumTransportResponse & { arrayBuffer: ReturnType<typeof vi.fn> } = {
      status: 200,
      headers: new Headers({ 'content-type': 'audio/wav' }),
      body,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    }
    const { adapter } = createAdapter(response)

    await expect(adapter.synthesize(createInput())).rejects.toMatchObject({
      failure: { code: 'invalid_provider_output', reason: 'malformed_body' },
    })
    expect(cancelled).toBe(true)
  })

  it('does not fall back to an unbounded arrayBuffer when the response has no stream body', async () => {
    const arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(20_000_000))
    const response: GradiumTransportResponse & { arrayBuffer: ReturnType<typeof vi.fn> } = {
      status: 200,
      headers: new Headers({ 'content-type': 'audio/wav' }),
      body: null,
      arrayBuffer,
    }
    const { adapter } = createAdapter(response)

    await expect(adapter.synthesize(createInput())).rejects.toMatchObject({
      failure: { code: 'invalid_provider_output', reason: 'malformed_body' },
    })
    expect(arrayBuffer).not.toHaveBeenCalled()
  })
})

// eslint-disable-next-line max-lines-per-function
describe('GradiumTextToSpeechAdapter cancellation and timeout', () => {
  it('propagates caller cancellation and maps it without provider details', async () => {
    let request: GradiumTransportRequest | undefined
    const post = vi.fn((candidate: GradiumTransportRequest) => {
      request = candidate
      return new Promise<GradiumTransportResponse>((_resolve, reject) => {
        candidate.signal.addEventListener('abort', () => {
          reject(Object.assign(new Error('provider secret'), { name: 'AbortError' }))
        })
      })
    })
    const observability = createObservability()
    const adapter = new GradiumTextToSpeechAdapter(
      {
        apiKey: 'gradium-secret-test',
        endpoint: 'https://gradium.test/api/post/speech/tts',
        timeoutMs: 30_000,
        limits: TEXT_TO_SPEECH_LIMITS,
        voiceMap: { 'avatar-default': 'provider-voice-123' },
      },
      observability.adapter,
      { post } satisfies GradiumTransport,
    )
    const controller = new AbortController()
    const synthesis = adapter.synthesize(createInput(), { signal: controller.signal })
    controller.abort()

    await expect(synthesis).rejects.toMatchObject({
      failure: { code: 'cancelled', phase: 'during_synthesis' },
    })
    expect(request?.signal.aborted).toBe(true)
  })

  it('maps adapter timeout and aborts the provider request', async () => {
    vi.useFakeTimers()
    try {
      let request: GradiumTransportRequest | undefined
      const post = vi.fn((candidate: GradiumTransportRequest) => {
        request = candidate
        return new Promise<GradiumTransportResponse>((_resolve, reject) => {
          candidate.signal.addEventListener('abort', () => {
            reject(Object.assign(new Error('timeout'), { name: 'AbortError' }))
          })
        })
      })
      const observability = createObservability()
      const adapter = new GradiumTextToSpeechAdapter(
        {
          apiKey: 'gradium-secret-test',
          endpoint: 'https://gradium.test/api/post/speech/tts',
          timeoutMs: 100,
          limits: TEXT_TO_SPEECH_LIMITS,
          voiceMap: { 'avatar-default': 'provider-voice-123' },
        },
        observability.adapter,
        { post } satisfies GradiumTransport,
      )
      const synthesis = adapter.synthesize(createInput())
      const failure = expect(synthesis).rejects.toMatchObject({ failure: { code: 'timeout' } })
      await vi.advanceTimersByTimeAsync(100)
      await failure
      expect(request?.signal.aborted).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('cancels a provider body reader when the caller aborts during output delivery', async () => {
    const response = createResponse(new Uint8Array(), {
      contentType: 'audio/wav',
      closeBody: false,
    })
    const post = vi.fn<GradiumTransport['post']>().mockResolvedValue(response)
    const observability = createObservability()
    const adapter = new GradiumTextToSpeechAdapter(
      {
        apiKey: 'gradium-secret-test',
        endpoint: 'https://gradium.test/api/post/speech/tts',
        timeoutMs: 30_000,
        limits: TEXT_TO_SPEECH_LIMITS,
        voiceMap: { 'avatar-default': 'provider-voice-123' },
      },
      observability.adapter,
      { post } satisfies GradiumTransport,
    )
    const controller = new AbortController()
    const synthesis = adapter.synthesize(createInput(), { signal: controller.signal })
    await vi.waitFor(() => {
      expect(post).toHaveBeenCalled()
    })

    controller.abort()

    await expect(synthesis).rejects.toMatchObject({
      failure: { code: 'cancelled', phase: 'during_synthesis' },
    })
    expect(response.cancelled()).toBe(true)
  })

  it('cancels a provider body reader when the adapter timeout fires during output delivery', async () => {
    vi.useFakeTimers()
    try {
      const response = createResponse(new Uint8Array(), {
        contentType: 'audio/wav',
        closeBody: false,
      })
      const { adapter, post } = createAdapter(response, { timeoutMs: 100 })
      const synthesis = adapter.synthesize(createInput())
      const failure = expect(synthesis).rejects.toMatchObject({ failure: { code: 'timeout' } })

      await vi.advanceTimersByTimeAsync(100)

      await failure
      expect(post).toHaveBeenCalledTimes(1)
      expect(response.cancelled()).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('records only bounded success metadata', async () => {
    const { adapter, trace } = createAdapter(
      createResponse(Uint8Array.from([1, 2]), { contentType: 'audio/wav', declaredLength: '2' }),
    )

    await adapter.synthesize(createInput())

    const event = trace.mock.calls[0]?.[0] as TraceEvent | undefined
    const serialized = JSON.stringify(event)
    expect(event).toMatchObject({
      requestId: 'request-1',
      event: 'text_to_speech',
      output: { byteCount: 2, format: 'audio/wav' },
      metadata: { provider: 'gradium', outcome: 'success', byteCount: 2, format: 'audio/wav' },
    })
    expect(serialized).not.toContain('gradium-secret-test')
    expect(serialized).not.toContain('Hello from the avatar.')
  })
})

describe('createTextToSpeechAdapter', () => {
  it('uses the null adapter by default without provider credentials', async () => {
    const adapter = createTextToSpeechAdapter(
      {
        provider: 'null',
        endpoint: 'https://gradium.test/api/post/speech/tts',
        timeoutMs: 30_000,
        limits: TEXT_TO_SPEECH_LIMITS,
        voiceMap: {},
      },
      createObservability().adapter,
    )

    await expect(adapter.synthesize(createInput())).rejects.toMatchObject({
      failure: { code: 'provider_unavailable' },
    })
  })

  it('reports selected Gradium configuration without credentials as invalid configuration', async () => {
    const adapter = createTextToSpeechAdapter(
      {
        provider: 'gradium',
        endpoint: 'https://gradium.test/api/post/speech/tts',
        timeoutMs: 30_000,
        limits: TEXT_TO_SPEECH_LIMITS,
        voiceMap: {},
      },
      createObservability().adapter,
    )

    await expect(adapter.synthesize(createInput())).rejects.toMatchObject({
      failure: { code: 'invalid_configuration', reason: 'missing_credentials' },
    })
  })

  it('does not expose secrets through typed failures', () => {
    const error = new TextToSpeechError({
      code: 'invalid_configuration',
      reason: 'missing_credentials',
      retryable: false,
    })
    expect(error.message).not.toContain('gradium')
  })
})

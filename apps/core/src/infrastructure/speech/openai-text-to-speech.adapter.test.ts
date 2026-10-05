import OpenAI from 'openai'
import { describe, expect, it, vi } from 'vitest'
import type {
  IObservabilityAdapter,
  TraceEvent,
} from '../../application/ports/IObservabilityAdapter.js'
import {
  TEXT_TO_SPEECH_LIMITS,
  type TextToSpeechInput,
} from '../../application/ports/ITextToSpeechAdapter.js'
import {
  OpenAiTextToSpeechAdapter,
  type OpenAiSpeechClient,
} from './openai-text-to-speech.adapter.js'

type CreateSpeech = OpenAiSpeechClient['audio']['speech']['create']

function createInput(overrides: Partial<TextToSpeechInput> = {}): TextToSpeechInput {
  return {
    text: 'Hello from the avatar.',
    voiceId: 'marin',
    format: 'audio/wav',
    requestId: 'request-1',
    messageId: 'message-1',
    ...overrides,
  }
}

function audioResponse(bytes: Uint8Array, contentType: string): Pick<Response, 'headers' | 'body'> {
  return new Response(bytes, { headers: { 'content-type': contentType } })
}

function createAdapter(
  create: CreateSpeech,
  options: { maxOutputBytes?: number } = {},
): { adapter: OpenAiTextToSpeechAdapter; trace: ReturnType<typeof vi.fn> } {
  const trace = vi.fn<(event: TraceEvent) => Promise<void>>().mockResolvedValue(undefined)
  const observability: IObservabilityAdapter = {
    trace,
    flush: vi.fn().mockResolvedValue(undefined),
  }
  const adapter = new OpenAiTextToSpeechAdapter(
    {
      apiKey: 'openai-secret-test',
      model: 'gpt-4o-mini-tts',
      timeoutMs: 30_000,
      limits: {
        ...TEXT_TO_SPEECH_LIMITS,
        ...(options.maxOutputBytes === undefined ? {} : { maxOutputBytes: options.maxOutputBytes }),
      },
    },
    observability,
    { audio: { speech: { create } } },
  )
  return { adapter, trace }
}

async function synthesizeAll(
  adapter: OpenAiTextToSpeechAdapter,
  input: TextToSpeechInput,
): Promise<{ audio: number[]; metadata: unknown }> {
  const stream = await adapter.synthesize(input)
  const audio: number[] = []
  for await (const chunk of stream.audio) audio.push(...chunk)
  return { audio, metadata: stream.metadata }
}

describe('OpenAiTextToSpeechAdapter', () => {
  it('lists the built-in multilingual voices with a default voice', async () => {
    const { adapter } = createAdapter(vi.fn<CreateSpeech>())

    const voices = await adapter.listVoices()

    expect(adapter.provider).toBe('openai')
    expect(voices.map((voice) => voice.voiceId)).toContain('alloy')
    expect(voices.find((voice) => voice.voiceId === 'marin')).toEqual({
      voiceId: 'marin',
      name: 'Marin',
    })
    await expect(adapter.getDefaultVoiceId()).resolves.toBe('marin')
  })

  it.each([
    ['audio/wav', 'wav', 'audio/wav'],
    ['audio/ogg', 'opus', 'audio/opus'],
    ['audio/mpeg', 'mp3', 'audio/mpeg'],
    ['audio/pcm', 'pcm', 'audio/pcm'],
  ] as const)(
    'synthesizes %s through the %s response format',
    async (format, responseFormat, contentType) => {
      const create = vi
        .fn<CreateSpeech>()
        .mockResolvedValue(audioResponse(Uint8Array.from([1, 2, 3]), contentType))
      const { adapter, trace } = createAdapter(create)

      const result = await synthesizeAll(adapter, createInput({ format }))

      expect(create).toHaveBeenCalledWith(
        {
          model: 'gpt-4o-mini-tts',
          voice: 'marin',
          input: 'Hello from the avatar.',
          response_format: responseFormat,
        },
        { signal: expect.any(AbortSignal) as unknown },
      )
      expect(result).toEqual({
        audio: [1, 2, 3],
        metadata: { requestId: 'request-1', messageId: 'message-1', format },
      })
      const serialized = JSON.stringify(trace.mock.calls)
      expect(serialized).toContain('"provider":"openai"')
      expect(serialized).not.toContain('openai-secret-test')
      expect(serialized).not.toContain('Hello from the avatar.')
    },
  )

  it('rejects text over the OpenAI input limit and unsupported formats before calling it', async () => {
    const create = vi.fn<CreateSpeech>()
    const { adapter } = createAdapter(create)

    await expect(adapter.synthesize(createInput({ text: 'a'.repeat(4097) }))).rejects.toMatchObject(
      { failure: { code: 'invalid_request', reason: 'text_too_long' } },
    )
    await expect(adapter.synthesize(createInput({ format: 'audio/webm' }))).rejects.toMatchObject({
      failure: { code: 'unsupported_format' },
    })
    expect(create).not.toHaveBeenCalled()
  })

  it('rejects oversized or mistyped audio', async () => {
    const oversized = createAdapter(
      vi.fn<CreateSpeech>().mockResolvedValue(audioResponse(new Uint8Array(10), 'audio/wav')),
      { maxOutputBytes: 4 },
    )
    await expect(synthesizeAll(oversized.adapter, createInput())).rejects.toMatchObject({
      failure: { code: 'invalid_provider_output', reason: 'oversized' },
    })

    const mistyped = createAdapter(
      vi.fn<CreateSpeech>().mockResolvedValue(audioResponse(Uint8Array.from([1]), 'text/html')),
    )
    await expect(mistyped.adapter.synthesize(createInput())).rejects.toMatchObject({
      failure: { code: 'invalid_provider_output', reason: 'invalid_content_type' },
    })
  })

  it.each([
    [429, 'rate_limited'],
    [401, 'invalid_configuration'],
    [400, 'provider_unavailable'],
    [503, 'provider_unavailable'],
  ] as const)('maps HTTP %i to %s', async (status, code) => {
    const error = OpenAI.APIError.generate(status, { message: 'nope' }, 'nope', new Headers())
    const { adapter } = createAdapter(vi.fn<CreateSpeech>().mockRejectedValue(error))

    await expect(adapter.synthesize(createInput())).rejects.toMatchObject({ failure: { code } })
  })

  it('maps SDK timeouts and caller cancellation', async () => {
    const timedOut = createAdapter(
      vi.fn<CreateSpeech>().mockRejectedValue(new OpenAI.APIConnectionTimeoutError()),
    )
    await expect(timedOut.adapter.synthesize(createInput())).rejects.toMatchObject({
      failure: { code: 'timeout' },
    })

    const controller = new AbortController()
    const cancelled = createAdapter(
      vi.fn<CreateSpeech>().mockImplementation(() => {
        controller.abort()
        return Promise.reject(new OpenAI.APIUserAbortError())
      }),
    )
    await expect(
      cancelled.adapter.synthesize(createInput(), { signal: controller.signal }),
    ).rejects.toMatchObject({ failure: { code: 'cancelled' } })
  })
})

import { describe, expect, it, vi } from 'vitest'
import type { ApiResponse, AudioDeliveryMetadata, AudioOutputFormat } from '@gami/shared'
import type {
  ITextToSpeechAdapter,
  TextToSpeechInput,
  TextToSpeechOptions,
} from '../../application/ports/ITextToSpeechAdapter.js'
import { TextToSpeechError } from '../../application/ports/ITextToSpeechAdapter.js'
import { TextToSpeechProviders } from '../../application/voice/text-to-speech-providers.js'
import type { Conversation, Message } from '../../domain/conversation/session.types.js'
import type { AvatarConfig } from '../../domain/avatar/avatar.types.js'
import type { Scenario } from '../../domain/scenario/scenario.types.js'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryConversationRepository } from '../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryMessageRepository } from '../../infrastructure/db/in-memory-message.repository.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'
import { NullLlmAdapter } from '../../infrastructure/llm/index.js'
import { NullObservabilityAdapter } from '../../infrastructure/observability/index.js'
import { createServer } from '../server.js'
import { TEST_CONFIG } from './test-config.js'

const conversation: Conversation = {
  conversationId: 'conversation_1',
  sessionId: 'session_1',
  avatarId: 'avatar_1',
  status: 'active',
  startedAt: '2026-09-11T10:00:00.000Z',
  lastActivityAt: '2026-09-11T10:00:00.000Z',
}

const scenario: Scenario = {
  scenarioId: 'scenario_1',
  name: 'Scenario',
  status: 'active',
  objectives: [],
  worldContext: '',
  avatarAvailability: { initialAvatarIds: [] },
  voiceConfig: { provider: 'gradium', voiceId: 'scenario-default' },
  config: {},
  createdAt: conversation.startedAt,
  updatedAt: conversation.startedAt,
}

const avatar: AvatarConfig = {
  avatarId: 'avatar_1',
  scenarioId: 'scenario_1',
  name: 'Ava',
  status: 'active',
  personaPrompt: 'You are Ava.',
  voiceConfig: { provider: 'gradium', voiceId: 'avatar-override' },
  config: {},
  createdAt: conversation.startedAt,
  updatedAt: conversation.startedAt,
}

const avatarMessage: Message = {
  messageId: 'message_avatar_1',
  conversationId: conversation.conversationId,
  role: 'avatar',
  content: 'Hello, traveler.',
  createdAt: conversation.startedAt,
}

const userMessage: Message = {
  messageId: 'message_user_1',
  conversationId: conversation.conversationId,
  role: 'user',
  content: 'Hello.',
  createdAt: conversation.startedAt,
}

type StreamOutcome = {
  /** Chunks streamed in order; an error entry is thrown at that point of the stream. */
  chunks?: (Uint8Array | TextToSpeechError)[]
  metadata?: Partial<AudioDeliveryMetadata>
}

function createTtsAdapter(
  outcome?: StreamOutcome | TextToSpeechError,
  defaultVoiceId: string | null = 'provider-default',
): ITextToSpeechAdapter & {
  requests: TextToSpeechInput[]
  signals: (AbortSignal | undefined)[]
} {
  const requests: TextToSpeechInput[] = []
  const signals: (AbortSignal | undefined)[] = []
  const synthesize = vi
    .fn<ITextToSpeechAdapter['synthesize']>()
    .mockImplementation((input: TextToSpeechInput, options?: TextToSpeechOptions) => {
      requests.push(input)
      signals.push(options?.signal)
      if (outcome instanceof TextToSpeechError) return Promise.reject(outcome)
      const chunks = outcome?.chunks ?? [Uint8Array.from([7, 8]), Uint8Array.from([9])]
      async function* audio(): AsyncGenerator<Uint8Array> {
        for (const chunk of chunks) {
          await Promise.resolve()
          if (chunk instanceof TextToSpeechError) throw chunk
          yield chunk
        }
      }
      return Promise.resolve({
        audio: audio(),
        metadata: {
          requestId: input.requestId,
          messageId: input.messageId,
          format: input.format,
          ...outcome?.metadata,
        },
      })
    })
  return {
    provider: 'gradium',
    synthesize,
    listVoices: () => Promise.resolve([]),
    getDefaultVoiceId: () => Promise.resolve(defaultVoiceId ?? undefined),
    requests,
    signals,
  }
}

function createApp(tts: ITextToSpeechAdapter, extraMessages: Message[] = []) {
  return createServer(TEST_CONFIG, {
    llmAdapter: new NullLlmAdapter('unused', 'null-model'),
    observabilityAdapter: new NullObservabilityAdapter(),
    avatarRepository: new InMemoryAvatarRepository([avatar]),
    scenarioRepository: new InMemoryScenarioRepository([scenario]),
    conversationRepository: new InMemoryConversationRepository([conversation]),
    messageRepository: new InMemoryMessageRepository([
      avatarMessage,
      userMessage,
      ...extraMessages,
    ]),
    textToSpeechProviders: new TextToSpeechProviders([tts], 'gradium'),
  })
}

function headers(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    'x-api-key': 'test-secret',
    'content-type': 'application/json',
    ...overrides,
  }
}

function audioUrl(messageId = avatarMessage.messageId): string {
  return `/v1/conversations/${conversation.conversationId}/messages/${messageId}/audio`
}

function expectError(
  response: { statusCode: number; json: () => unknown },
  status: number,
  code: string,
): void {
  expect(response.statusCode).toBe(status)
  const body = response.json() as ApiResponse<null>
  expect(body.data).toBeNull()
  expect(body.error?.code).toBe(code)
}

// eslint-disable-next-line max-lines-per-function
describe('conversation message audio route', () => {
  it.each([
    [{}, 401],
    [{ 'x-api-key': 'wrong-secret' }, 401],
  ] as const)('rejects unauthorized requests', async (authHeaders, status) => {
    const app = createApp(createTtsAdapter())
    const response = await app.inject({
      method: 'POST',
      url: audioUrl(),
      headers: { 'content-type': 'application/json', ...authHeaders },
      payload: {},
    })

    expectError(response, status, 'UNAUTHORIZED')
  })

  it('rejects unsupported formats and malformed JSON with the standard validation envelope', async () => {
    const app = createApp(createTtsAdapter())

    const unsupported = await app.inject({
      method: 'POST',
      url: audioUrl(),
      headers: headers(),
      payload: { format: 'audio/flac' },
    })
    expectError(unsupported, 400, 'VALIDATION_ERROR')

    const malformed = await app.inject({
      method: 'POST',
      url: audioUrl(),
      headers: headers(),
      payload: '{"format":',
    })
    expectError(malformed, 400, 'VALIDATION_ERROR')
  })

  it('streams the synthesized Avatar content with its metadata headers', async () => {
    const tts = createTtsAdapter()
    const app = createApp(tts)

    const response = await app.inject({
      method: 'POST',
      url: audioUrl(),
      headers: headers(),
      payload: { format: 'audio/ogg' satisfies AudioOutputFormat },
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toBe('audio/ogg')
    expect(response.headers['content-length']).toBeUndefined()
    expect(response.headers['content-disposition']).toBe('inline')
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.headers['x-message-id']).toBe(avatarMessage.messageId)
    expect(response.headers['x-request-id']).toBe(tts.requests[0]?.requestId)
    expect(response.rawPayload).toEqual(Buffer.from([7, 8, 9]))
    expect(tts.requests[0]).toMatchObject({
      text: avatarMessage.content,
      voiceId: 'avatar-override',
      format: 'audio/ogg',
      messageId: avatarMessage.messageId,
    })
  })

  it.each([
    ['unknown conversation', '/v1/conversations/conversation_missing/messages/message_1/audio'],
    ['unknown message', '/v1/conversations/conversation_1/messages/message_missing/audio'],
  ] as const)('returns 404 for an %s', async (_label, url) => {
    const tts = createTtsAdapter()
    const app = createApp(tts)

    const response = await app.inject({ method: 'POST', url, headers: headers(), payload: {} })

    expectError(response, 404, 'NOT_FOUND')
    expect(tts.requests).toHaveLength(0)
  })

  it('exposes the audio metadata headers to cross-origin browsers', async () => {
    const app = createApp(createTtsAdapter())

    const response = await app.inject({
      method: 'POST',
      url: audioUrl(),
      headers: headers({ origin: 'http://localhost:5173' }),
      payload: {},
    })

    expect(response.statusCode).toBe(200)
    const exposed = (response.headers['access-control-expose-headers'] ?? '')
      .toLowerCase()
      .split(/,\s*/)
    expect(exposed).toEqual(expect.arrayContaining(['x-request-id', 'x-message-id']))
  })

  it('returns 404 for a message that belongs to another conversation', async () => {
    const foreignMessage: Message = {
      ...avatarMessage,
      messageId: 'message_foreign',
      conversationId: 'conversation_2',
    }
    const tts = createTtsAdapter()
    const app = createApp(tts, [foreignMessage])

    const response = await app.inject({
      method: 'POST',
      url: audioUrl(foreignMessage.messageId),
      headers: headers(),
      payload: {},
    })

    expectError(response, 404, 'NOT_FOUND')
    expect(tts.requests).toHaveLength(0)
  })

  it('rejects a user message without calling synthesis', async () => {
    const tts = createTtsAdapter()
    const app = createApp(tts)

    const response = await app.inject({
      method: 'POST',
      url: audioUrl(userMessage.messageId),
      headers: headers(),
      payload: {},
    })

    expectError(response, 409, 'CONFLICT')
    expect(tts.requests).toHaveLength(0)
  })

  it('rejects an unusable empty Avatar message without calling synthesis', async () => {
    const emptyMessage: Message = {
      ...avatarMessage,
      messageId: 'message_empty_avatar',
      content: '   ',
    }
    const tts = createTtsAdapter()
    const app = createApp(tts, [emptyMessage])

    const response = await app.inject({
      method: 'POST',
      url: audioUrl(emptyMessage.messageId),
      headers: headers(),
      payload: {},
    })

    expectError(response, 400, 'VALIDATION_ERROR')
    expect(tts.requests).toHaveLength(0)
  })

  it('maps an unavailable voice and synthesis failures without changing the message', async () => {
    const missingVoiceTts = createTtsAdapter(undefined, null)
    const avatarWithoutVoice = { ...avatar }
    delete avatarWithoutVoice.voiceConfig
    const scenarioWithoutVoice = { ...scenario }
    delete scenarioWithoutVoice.voiceConfig
    const missingVoiceApp = createServer(TEST_CONFIG, {
      observabilityAdapter: new NullObservabilityAdapter(),
      avatarRepository: new InMemoryAvatarRepository([avatarWithoutVoice]),
      scenarioRepository: new InMemoryScenarioRepository([scenarioWithoutVoice]),
      conversationRepository: new InMemoryConversationRepository([conversation]),
      messageRepository: new InMemoryMessageRepository([avatarMessage]),
      textToSpeechProviders: new TextToSpeechProviders([missingVoiceTts], 'gradium'),
    })
    const missingVoice = await missingVoiceApp.inject({
      method: 'POST',
      url: audioUrl(),
      headers: headers(),
      payload: {},
    })
    expectError(missingVoice, 409, 'CONFLICT')
    expect(missingVoiceTts.requests).toHaveLength(0)

    const failureTts = createTtsAdapter(new TextToSpeechError({ code: 'timeout', retryable: true }))
    const failureApp = createApp(failureTts)
    const failure = await failureApp.inject({
      method: 'POST',
      url: audioUrl(),
      headers: headers(),
      payload: {},
    })
    expectError(failure, 504, 'TIMEOUT')
    expect(failureTts.requests).toHaveLength(1)
  })

  it('rejects an adapter stream for another request before sending audio', async () => {
    const app = createApp(createTtsAdapter({ metadata: { requestId: 'request_other' } }))

    const response = await app.inject({
      method: 'POST',
      url: audioUrl(),
      headers: headers(),
      payload: {},
    })

    expectError(response, 502, 'PROVIDER_ERROR')
  })

  it.each([
    [
      new TextToSpeechError({ code: 'invalid_request', reason: 'empty_text', retryable: false }),
      400,
      'VALIDATION_ERROR',
    ],
    [
      new TextToSpeechError({ code: 'provider_unavailable', retryable: false }),
      502,
      'PROVIDER_ERROR',
    ],
    [new TextToSpeechError({ code: 'rate_limited', retryable: true }), 429, 'RATE_LIMITED'],
    [
      new TextToSpeechError({ code: 'unsupported_format', format: 'audio/wav', retryable: false }),
      400,
      'VALIDATION_ERROR',
    ],
    [
      new TextToSpeechError({
        code: 'invalid_provider_output',
        reason: 'malformed_body',
        retryable: false,
      }),
      502,
      'PROVIDER_ERROR',
    ],
  ] as const)(
    'maps synthesis failure %s to the stable API error %s',
    async (failure, status, code) => {
      const app = createApp(createTtsAdapter(failure))
      const response = await app.inject({
        method: 'POST',
        url: audioUrl(),
        headers: headers(),
        payload: {},
      })

      expectError(response, status, code)
    },
  )

  it('maps a provider failure before the first audio chunk to an API error', async () => {
    const app = createApp(
      createTtsAdapter({
        chunks: [new TextToSpeechError({ code: 'provider_unavailable', retryable: true })],
      }),
    )

    const response = await app.inject({
      method: 'POST',
      url: audioUrl(),
      headers: headers(),
      payload: {},
    })

    expectError(response, 502, 'PROVIDER_ERROR')
  })

  it('accepts raw PCM delivery', async () => {
    const tts = createTtsAdapter()
    const response = await createApp(tts).inject({
      method: 'POST',
      url: audioUrl(),
      headers: headers(),
      payload: { format: 'audio/pcm' satisfies AudioOutputFormat },
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toBe('audio/pcm')
    expect(tts.requests[0]?.format).toBe('audio/pcm')
  })

  it('sends the first audio before synthesis ends and cancels it when the client disconnects', async () => {
    let providerSignal: AbortSignal | undefined
    const tts: ITextToSpeechAdapter = {
      provider: 'gradium',
      listVoices: () => Promise.resolve([]),
      getDefaultVoiceId: () => Promise.resolve('provider-default'),
      synthesize: (input, options) => {
        providerSignal = options?.signal
        async function* audio(): AsyncGenerator<Uint8Array> {
          yield Uint8Array.from([1, 2])
          // The provider is still synthesizing; only a cancelled request ends this stream.
          await new Promise((resolve) => options?.signal?.addEventListener('abort', resolve))
        }
        return Promise.resolve({
          audio: audio(),
          metadata: {
            requestId: input.requestId,
            messageId: input.messageId,
            format: input.format,
          },
        })
      },
    }
    const app = createApp(tts)
    const address = await app.listen({ port: 0, host: '127.0.0.1' })
    try {
      const client = new AbortController()
      const response = await fetch(`${address}${audioUrl()}`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ format: 'audio/pcm' }),
        signal: client.signal,
      })
      const reader = response.body?.getReader()
      await expect(reader?.read()).resolves.toMatchObject({ value: Uint8Array.from([1, 2]) })
      client.abort()

      await vi.waitFor(() => {
        expect(providerSignal?.aborted).toBe(true)
      })
    } finally {
      app.server.closeAllConnections()
      await app.close()
    }
  })

  it('propagates route cancellation to the application adapter and maps it safely', async () => {
    const tts = createTtsAdapter(
      new TextToSpeechError({ code: 'cancelled', phase: 'during_synthesis', retryable: false }),
    )
    const app = createApp(tts)

    const response = await app.inject({
      method: 'POST',
      url: audioUrl(),
      headers: headers(),
      payload: {},
    })

    expectError(response, 409, 'CONFLICT')
    expect(tts.signals[0]?.aborted).toBe(true)
  })
})

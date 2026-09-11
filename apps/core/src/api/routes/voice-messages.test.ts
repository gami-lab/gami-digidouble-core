import { describe, expect, it, vi } from 'vitest'
import { processSseFrames } from '@gami/shared'
import type { ApiResponse, MessageStreamEvent, SendMessageResponse } from '@gami/shared'
import type { ISpeechToTextAdapter } from '../../application/ports/ISpeechToTextAdapter.js'
import {
  SPEECH_TO_TEXT_LIMITS,
  SpeechToTextError,
} from '../../application/ports/ISpeechToTextAdapter.js'
import type { ILlmAdapter, LlmRequest } from '../../application/ports/ILlmAdapter.js'
import type { Conversation, Session } from '../../domain/conversation/session.types.js'
import type { AvatarConfig } from '../../domain/avatar/avatar.types.js'
import type { Scenario } from '../../domain/scenario/scenario.types.js'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryConversationRepository } from '../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryMessageRepository } from '../../infrastructure/db/in-memory-message.repository.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
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

const session: Session = {
  sessionId: 'session_1',
  userId: 'user_1',
  scenarioId: 'scenario_1',
  status: 'active',
  startedAt: conversation.startedAt,
  lastActivityAt: conversation.lastActivityAt,
}

const scenario: Scenario = {
  scenarioId: 'scenario_1',
  name: 'Scenario',
  status: 'active',
  objectives: [],
  worldContext: '',
  avatarAvailability: { initialAvatarIds: [] },
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
  config: {},
  createdAt: conversation.startedAt,
  updatedAt: conversation.startedAt,
}

function makeSpeechAdapter(
  result: Awaited<ReturnType<ISpeechToTextAdapter['transcribe']>> = {
    kind: 'final',
    transcript: 'Hello from voice',
  },
) {
  return {
    transcribe: vi.fn<ISpeechToTextAdapter['transcribe']>().mockResolvedValue(result),
  }
}

function makeApp(
  speechToTextAdapter: ISpeechToTextAdapter = makeSpeechAdapter(),
  llmAdapter: ILlmAdapter = new NullLlmAdapter('Avatar reply', 'null-model'),
  messageRepository = new InMemoryMessageRepository(),
) {
  return {
    app: createServer(TEST_CONFIG, {
      llmAdapter,
      speechToTextAdapter,
      observabilityAdapter: new NullObservabilityAdapter(),
      avatarRepository: new InMemoryAvatarRepository([avatar]),
      scenarioRepository: new InMemoryScenarioRepository([scenario]),
      sessionRepository: new InMemorySessionRepository([session]),
      conversationRepository: new InMemoryConversationRepository([conversation]),
      messageRepository,
    }),
    messageRepository,
  }
}

function headers(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    'x-api-key': 'test-secret',
    'content-type': 'audio/webm',
    'x-utterance-id': 'utterance_1',
    ...overrides,
  }
}

function parseEvents(body: string): MessageStreamEvent[] {
  const events: MessageStreamEvent[] = []
  processSseFrames(body, (event) => events.push(event as MessageStreamEvent))
  return events
}

// eslint-disable-next-line max-lines-per-function
describe('voice message HTTP routes', () => {
  it('returns the canonical JSON response and forwards bounded metadata', async () => {
    const speech = makeSpeechAdapter()
    const { app } = makeApp(speech)

    const response = await app.inject({
      method: 'POST',
      url: '/v1/conversations/conversation_1/voice-messages',
      headers: headers({ 'x-language': 'fr-ch', 'x-audio-duration-ms': '1000' }),
      payload: Buffer.from([1, 2, 3]),
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<SendMessageResponse>>()
    expect(body.error).toBeNull()
    expect(body.data?.userMessage.content).toBe('Hello from voice')
    expect(speech.transcribe).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conversation_1',
        utteranceId: 'utterance_1',
        audio: Uint8Array.from([1, 2, 3]),
        mediaType: 'audio/webm',
        language: 'fr-CH',
        durationMs: 1000,
      }),
      expect.anything(),
    )
  })

  it('emits the existing ordered SSE event contract', async () => {
    const { app } = makeApp()

    const response = await app.inject({
      method: 'POST',
      url: '/v1/conversations/conversation_1/voice-messages/stream',
      headers: headers(),
      payload: Buffer.from([1, 2, 3]),
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/event-stream')
    const events = parseEvents(response.body)
    expect(events.map((event) => event.type)).toEqual([
      'conversation.message.started',
      'conversation.message.delta',
      'conversation.message.completed',
    ])
    expect(events.filter((event) => event.type === 'conversation.message.completed')).toHaveLength(
      1,
    )
  })

  it.each([undefined, 'wrong-secret'])('returns 401 for %s API key', async (apiKey) => {
    const { app } = makeApp()
    const requestHeaders = headers()
    if (apiKey === undefined) delete requestHeaders['x-api-key']
    else requestHeaders['x-api-key'] = apiKey

    const sync = await app.inject({
      method: 'POST',
      url: '/v1/conversations/conversation_1/voice-messages',
      headers: requestHeaders,
      payload: Buffer.from([1]),
    })
    const stream = await app.inject({
      method: 'POST',
      url: '/v1/conversations/conversation_1/voice-messages/stream',
      headers: requestHeaders,
      payload: Buffer.from([1]),
    })

    expect(sync.statusCode).toBe(401)
    expect(sync.json<ApiResponse<null>>().error?.code).toBe('UNAUTHORIZED')
    expect(stream.statusCode).toBe(401)
    expect(stream.json<ApiResponse<null>>().error?.code).toBe('UNAUTHORIZED')
  })

  it.each([
    { name: 'missing utterance ID', headers: headers(), payload: Buffer.from([1]) },
    {
      name: 'unsupported media type',
      headers: headers({ 'content-type': 'application/octet-stream' }),
      payload: Buffer.from([1]),
    },
    { name: 'empty audio', headers: headers(), payload: Buffer.alloc(0) },
    {
      name: 'invalid language',
      headers: headers({ 'x-language': 'not a language' }),
      payload: Buffer.from([1]),
    },
    {
      name: 'invalid duration',
      headers: headers({ 'x-audio-duration-ms': 'not-a-number' }),
      payload: Buffer.from([1]),
    },
  ])('returns 400 VALIDATION_ERROR for $name', async ({ name, headers: inputHeaders, payload }) => {
    const requestHeaders = { ...inputHeaders }
    if (name === 'missing utterance ID') delete requestHeaders['x-utterance-id']
    const { app } = makeApp()
    const response = await app.inject({
      method: 'POST',
      url: '/v1/conversations/conversation_1/voice-messages',
      headers: requestHeaders,
      payload,
    })

    expect(response.statusCode).toBe(400)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('VALIDATION_ERROR')
  })

  it('maps invalid stream input to the standard validation envelope', async () => {
    const { app } = makeApp()
    const requestHeaders = headers()
    delete requestHeaders['x-utterance-id']
    const response = await app.inject({
      method: 'POST',
      url: '/v1/conversations/conversation_1/voice-messages/stream',
      headers: requestHeaders,
      payload: Buffer.from([1]),
    })

    expect(response.statusCode).toBe(400)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('VALIDATION_ERROR')
  })

  it('rejects an oversized body before the speech adapter', async () => {
    const speech = makeSpeechAdapter()
    const { app } = makeApp(speech)
    const response = await app.inject({
      method: 'POST',
      url: '/v1/conversations/conversation_1/voice-messages',
      headers: headers(),
      payload: Buffer.alloc(SPEECH_TO_TEXT_LIMITS.maxAudioBytes + 1),
    })

    expect(response.statusCode).toBe(400)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('VALIDATION_ERROR')
    expect(speech.transcribe).not.toHaveBeenCalled()
  })

  it('rejects a mismatched declared content length before the speech adapter', async () => {
    const speech = makeSpeechAdapter()
    const { app } = makeApp(speech)
    const response = await app.inject({
      method: 'POST',
      url: '/v1/conversations/conversation_1/voice-messages',
      headers: { ...headers(), 'content-length': '99' },
      payload: Buffer.from([1, 2, 3]),
    })

    expect(response.statusCode).toBe(400)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('VALIDATION_ERROR')
    expect(speech.transcribe).not.toHaveBeenCalled()
  })

  it('returns NOT_FOUND before invoking speech transcription', async () => {
    const speech = makeSpeechAdapter()
    const { app } = makeApp(speech)
    const response = await app.inject({
      method: 'POST',
      url: '/v1/conversations/conversation_missing/voice-messages',
      headers: headers(),
      payload: Buffer.from([1]),
    })

    expect(response.statusCode).toBe(404)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('NOT_FOUND')
    expect(speech.transcribe).not.toHaveBeenCalled()
  })

  it.each([
    { code: 'timeout' as const, status: 504, apiCode: 'TIMEOUT' as const },
    { code: 'rate_limited' as const, status: 429, apiCode: 'RATE_LIMITED' as const },
    { code: 'provider_failure' as const, status: 502, apiCode: 'PROVIDER_ERROR' as const },
  ])('maps $code to a safe API error', async ({ code, status, apiCode }) => {
    const speech = makeSpeechAdapter()
    speech.transcribe.mockRejectedValue(
      code === 'provider_failure'
        ? new SpeechToTextError({ code, retryable: false })
        : new SpeechToTextError({ code, retryable: true }),
    )
    const { app } = makeApp(speech)

    const response = await app.inject({
      method: 'POST',
      url: '/v1/conversations/conversation_1/voice-messages',
      headers: headers(),
      payload: Buffer.from([1]),
    })

    expect(response.statusCode).toBe(status)
    expect(response.json<ApiResponse<null>>().error?.code).toBe(apiCode)
    expect(response.body).not.toContain('provider')
  })

  it('rejects a duplicate utterance without a second user turn', async () => {
    const speech = makeSpeechAdapter()
    const { app, messageRepository } = makeApp(speech)
    const request = {
      method: 'POST' as const,
      url: '/v1/conversations/conversation_1/voice-messages',
      headers: headers(),
      payload: Buffer.from([1]),
    }

    expect((await app.inject(request)).statusCode).toBe(200)
    const duplicate = await app.inject(request)

    expect(duplicate.statusCode).toBe(409)
    expect(duplicate.json<ApiResponse<null>>().error?.code).toBe('CONFLICT')
    expect(speech.transcribe).toHaveBeenCalledTimes(1)
    const messages = await messageRepository.findByConversationId('conversation_1')
    expect(messages.filter((message) => message.role === 'user')).toHaveLength(1)
  })

  it('interrupts a voice stream without persisting partial Avatar content', async () => {
    const llm = new InterruptibleLlmAdapter()
    const messageRepository = new InMemoryMessageRepository()
    const { app } = makeApp(makeSpeechAdapter(), llm, messageRepository)
    app.addHook('preHandler', (request, _reply, done) => {
      if (request.url.endsWith('/voice-messages/stream'))
        setImmediate(() => request.raw.emit('close'))
      done()
    })

    const response = await app.inject({
      method: 'POST',
      url: '/v1/conversations/conversation_1/voice-messages/stream',
      headers: headers(),
      payload: Buffer.from([1]),
    })

    expect(response.statusCode).toBe(200)
    const events = parseEvents(response.body)
    expect(events.at(-1)?.type).toBe('conversation.message.interrupted')
    expect(events.some((event) => event.type === 'conversation.message.completed')).toBe(false)
    await llm.abortObserved
    await llm.iteratorClosed
    const messages = await messageRepository.findByConversationId('conversation_1')
    expect(messages.map((message) => message.role)).toEqual(['user'])
  })
})

class InterruptibleLlmAdapter implements ILlmAdapter {
  private resolveAbort: (() => void) | undefined
  private resolveIteratorClose: (() => void) | undefined
  readonly abortObserved = new Promise<void>((resolve) => {
    this.resolveAbort = resolve
  })
  readonly iteratorClosed = new Promise<void>((resolve) => {
    this.resolveIteratorClose = resolve
  })

  complete(_request: LlmRequest) {
    return Promise.resolve({
      content: 'Avatar reply',
      model: 'interruptible-model',
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
    })
  }

  async *stream(_request: LlmRequest, options?: { signal?: AbortSignal }) {
    const signal = options?.signal
    if (signal === undefined) throw new Error('Expected an abort signal')

    let onAbort: (() => void) | undefined
    try {
      yield { type: 'delta' as const, text: 'Partial answer' }
      await new Promise<void>((resolve) => {
        onAbort = () => {
          this.resolveAbort?.()
          resolve()
        }
        signal.addEventListener('abort', onAbort, { once: true })
      })
      throw Object.assign(new Error('provider aborted'), { name: 'AbortError' })
    } finally {
      if (onAbort !== undefined) signal.removeEventListener('abort', onAbort)
      this.resolveIteratorClose?.()
    }
  }
}

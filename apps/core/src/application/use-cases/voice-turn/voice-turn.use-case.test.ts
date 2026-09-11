import { describe, expect, it, vi } from 'vitest'
import type { Conversation, Message } from '../../../domain/conversation/session.types.js'
import type { IObservabilityAdapter } from '../../ports/IObservabilityAdapter.js'
import {
  normalizeSpeechToTextInput,
  SpeechToTextError,
  type SpeechToTextInput,
  type SpeechToTextOptions,
  type SpeechToTextResult,
} from '../../ports/ISpeechToTextAdapter.js'
import { InMemoryUtteranceIdempotencyStore } from '../../voice/test-support/in-memory-utterance-idempotency.store.js'
import type { SendMessageOutput } from '../send-message/send-message.types.js'
import type { SendMessageInput } from '../send-message/send-message.types.js'
import type { StreamingSendMessageEvent } from '../send-message/streaming-send-message.types.js'
import { VoiceTurnUseCase } from './voice-turn.use-case.js'
import { VoiceTurnError } from './voice-turn.types.js'

const conversation: Conversation = {
  conversationId: 'conversation-1',
  sessionId: 'session-1',
  avatarId: 'avatar-1',
  status: 'active',
  startedAt: '2026-09-11T10:00:00.000Z',
  lastActivityAt: '2026-09-11T10:00:00.000Z',
}

const input = normalizeSpeechToTextInput({
  conversationId: conversation.conversationId,
  utteranceId: 'utterance-1',
  audio: Uint8Array.from([1, 2, 3]),
  mediaType: 'audio/webm',
  durationMs: 1_000,
})

const output: SendMessageOutput = {
  requestId: 'conversation-request-1',
  conversationId: conversation.conversationId,
  conversation,
  session: {
    sessionId: 'session-1',
    userId: 'user-1',
    scenarioId: 'scenario-1',
    activeAvatarId: 'avatar-1',
    unlockedAvatarIds: [],
    status: 'active',
    startedAt: conversation.startedAt,
    lastActivityAt: conversation.lastActivityAt,
  },
  userMessage: {
    messageId: 'user-message-1',
    content: 'hello world',
    createdAt: conversation.startedAt,
  },
  avatarMessage: {
    messageId: 'avatar-message-1',
    content: 'Hi there.',
    createdAt: conversation.startedAt,
    model: 'test-model',
    inputTokens: 1,
    outputTokens: 2,
    latencyMs: 3,
  },
}

function createObservability(): {
  adapter: IObservabilityAdapter
  trace: ReturnType<typeof vi.fn>
} {
  const trace = vi.fn().mockResolvedValue(undefined)
  return { adapter: { trace, flush: vi.fn().mockResolvedValue(undefined) }, trace }
}

function createConversationRepository() {
  return { findById: vi.fn().mockResolvedValue(conversation) }
}

type TranscribeMock = ReturnType<
  typeof vi.fn<
    (input: SpeechToTextInput, options?: SpeechToTextOptions) => Promise<SpeechToTextResult>
  >
>
type SendMock = ReturnType<typeof vi.fn<(input: SendMessageInput) => Promise<SendMessageOutput>>>
type StreamMock = ReturnType<
  typeof vi.fn<
    (
      input: SendMessageInput,
      options?: SpeechToTextOptions,
    ) => AsyncIterable<StreamingSendMessageEvent>
  >
>

function createUseCase(
  overrides: {
    transcribe?: TranscribeMock
    send?: SendMock
    stream?: StreamMock
    store?: InMemoryUtteranceIdempotencyStore
  } = {},
) {
  const observability = createObservability()
  const transcribe: TranscribeMock =
    overrides.transcribe ??
    vi
      .fn<
        (input: SpeechToTextInput, options?: SpeechToTextOptions) => Promise<SpeechToTextResult>
      >()
      .mockResolvedValue({
        kind: 'final',
        transcript: '  hello   world ',
      })
  const send: SendMock =
    overrides.send ??
    vi.fn<(input: SendMessageInput) => Promise<SendMessageOutput>>().mockResolvedValue(output)
  const stream: StreamMock =
    overrides.stream ??
    vi.fn<
      (
        input: SendMessageInput,
        options?: SpeechToTextOptions,
      ) => AsyncIterable<StreamingSendMessageEvent>
    >()
  const store = overrides.store ?? new InMemoryUtteranceIdempotencyStore()
  const conversationRepository = createConversationRepository()
  return {
    useCase: new VoiceTurnUseCase(
      { transcribe },
      conversationRepository,
      store,
      { execute: send },
      { execute: stream },
      observability.adapter,
    ),
    transcribe,
    send,
    stream,
    store,
    conversationRepository,
    trace: observability.trace,
  }
}

describe('VoiceTurnUseCase synchronous execution', () => {
  it('normalizes the final transcript and delegates one normal turn', async () => {
    const { useCase, transcribe, send, store, trace } = createUseCase()

    await expect(useCase.execute(input)).resolves.toBe(output)

    expect(transcribe).toHaveBeenCalledWith(input, expect.anything())
    expect(send).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
      userMessage: 'hello world',
    })
    const transcriptionRequestId = transcribe.mock.calls[0]?.[1]?.requestId
    expect(transcriptionRequestId).toEqual(expect.any(String))
    expect(trace).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: transcriptionRequestId,
        event: 'voice_turn',
        output: { transcriptLength: 11 },
        metadata: expect.objectContaining({
          conversationId: 'conversation-1',
          utteranceId: 'utterance-1',
          outcome: 'success',
        }) as unknown,
      }),
    )
    await expect(
      store.reserve({ conversationId: 'conversation-1', utteranceId: 'utterance-1' }, 'other'),
    ).resolves.toEqual({ status: 'conflict' })
  })

  it.each([
    { kind: 'interim', transcript: 'hello' },
    { kind: 'final', transcript: '   ' },
  ] as const)('does not hand off a $kind invalid transcript', async (transcription) => {
    const { useCase, send, store } = createUseCase({
      transcribe: vi
        .fn<
          (input: SpeechToTextInput, options?: SpeechToTextOptions) => Promise<SpeechToTextResult>
        >()
        .mockResolvedValue(transcription),
    })

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(SpeechToTextError)
    expect(send).not.toHaveBeenCalled()
    await expect(
      store.reserve({ conversationId: 'conversation-1', utteranceId: 'utterance-1' }, 'other'),
    ).resolves.toEqual({
      status: 'claimed',
      reservationId: 'speech-reservation-2',
      expiresAt: expect.any(Number) as unknown,
    })
  })
})

describe('VoiceTurnUseCase idempotency and cancellation', () => {
  it('rejects an in-flight duplicate without a second transcription or turn', async () => {
    let resolveTranscription: ((value: { kind: 'final'; transcript: string }) => void) | undefined
    const transcribe: TranscribeMock = vi.fn(
      () =>
        new Promise<{ kind: 'final'; transcript: string }>((resolve) => {
          resolveTranscription = resolve
        }),
    )
    const { useCase, send } = createUseCase({ transcribe })
    const first = useCase.execute(input)
    await Promise.resolve()
    await expect(useCase.execute(input)).rejects.toEqual(new VoiceTurnError('in_flight'))

    resolveTranscription?.({ kind: 'final', transcript: 'hello' })
    await expect(first).resolves.toBe(output)
    expect(transcribe).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('rejects a completed duplicate and propagates provider failures without a turn', async () => {
    const first = createUseCase()
    await expect(first.useCase.execute(input)).resolves.toBe(output)
    await expect(first.useCase.execute(input)).rejects.toEqual(new VoiceTurnError('completed'))
    expect(first.send).toHaveBeenCalledTimes(1)

    const failure = createUseCase({
      transcribe: vi
        .fn<
          (input: SpeechToTextInput, options?: SpeechToTextOptions) => Promise<SpeechToTextResult>
        >()
        .mockRejectedValue(new SpeechToTextError({ code: 'timeout', retryable: true })),
    })
    await expect(failure.useCase.execute(input)).rejects.toMatchObject({
      failure: { code: 'timeout' },
    })
    expect(failure.send).not.toHaveBeenCalled()
  })

  it('cancels before transcription without touching conversation or provider work', async () => {
    const { useCase, transcribe, conversationRepository } = createUseCase()
    const controller = new AbortController()
    controller.abort()

    await expect(useCase.execute(input, { signal: controller.signal })).rejects.toMatchObject({
      failure: { code: 'cancelled', phase: 'before_transcription' },
    })
    expect(transcribe).not.toHaveBeenCalled()
    expect(conversationRepository.findById).not.toHaveBeenCalled()
  })

  it('validates the active conversation before transcription', async () => {
    const { useCase, transcribe, conversationRepository } = createUseCase()
    conversationRepository.findById.mockResolvedValue({ ...conversation, status: 'closed' })

    await expect(useCase.execute(input)).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(transcribe).not.toHaveBeenCalled()
  })
})

describe('VoiceTurnUseCase streaming execution', () => {
  it('hands the normalized transcript to the existing stream and preserves interruption', async () => {
    const started: Message = {
      messageId: 'user-message-1',
      conversationId: 'conversation-1',
      role: 'user',
      content: 'hello world',
      createdAt: conversation.startedAt,
    }
    const events: StreamingSendMessageEvent[] = [
      {
        type: 'started',
        requestId: 'conversation-request-1',
        conversationId: 'conversation-1',
        userMessage: started,
      },
      {
        type: 'interrupted',
        requestId: 'conversation-request-1',
        conversationId: 'conversation-1',
        reason: 'client_aborted',
      },
    ]
    const stream: StreamMock = vi.fn().mockReturnValue(
      (async function* (): AsyncIterable<StreamingSendMessageEvent> {
        await Promise.resolve()
        yield* events
      })(),
    )
    const { useCase, stream: streamMock, send, trace } = createUseCase({ stream })
    const received: StreamingSendMessageEvent[] = []

    for await (const event of useCase.executeStream(input, {
      signal: new AbortController().signal,
    })) {
      received.push(event)
    }

    expect(received).toEqual(events)
    expect(streamMock).toHaveBeenCalledWith(
      { conversationId: 'conversation-1', userMessage: 'hello world' },
      expect.anything(),
    )
    const streamOptions = streamMock.mock.calls[0]?.[1]
    expect(streamOptions?.signal).toBeInstanceOf(AbortSignal)
    expect(send).not.toHaveBeenCalled()
    expect(trace).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          outcome: 'interrupted',
          conversationRequestId: 'conversation-request-1',
        }) as unknown,
      }),
    )
  })
})

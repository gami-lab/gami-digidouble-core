import { describe, expect, it, vi } from 'vitest'
import type { AudioDeliveryMetadata } from '@gami/shared'
import type {
  ITextToSpeechAdapter,
  TextToSpeechInput,
  TextToSpeechOptions,
  TextToSpeechStream,
} from '../../ports/ITextToSpeechAdapter.js'
import { TextToSpeechError } from '../../ports/ITextToSpeechAdapter.js'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { Conversation, Message } from '../../../domain/conversation/session.types.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import { cleanAvatarResponse } from '../../../domain/avatar/avatar-response-cleaner.js'
import { InMemoryAvatarRepository } from '../../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryEventLogRepository } from '../../../infrastructure/db/in-memory-event-log.repository.js'
import { InMemoryConversationRepository } from '../../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryMessageRepository } from '../../../infrastructure/db/in-memory-message.repository.js'
import { InMemoryScenarioRepository } from '../../../infrastructure/db/in-memory-scenario.repository.js'
import { TextToSpeechProviders } from '../../voice/text-to-speech-providers.js'
import { SynthesizeMessageAudioUseCase } from './synthesize-message-audio.use-case.js'

const conversation: Conversation = {
  conversationId: 'conversation_1',
  sessionId: 'session_1',
  avatarId: 'avatar_1',
  status: 'active',
  startedAt: '2026-09-12T10:00:00.000Z',
  lastActivityAt: '2026-09-12T10:00:00.000Z',
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

const rawAvatarContent = '**Ava:** The archive is open.\n\n*Ava pauses.*\n\nBring the key.'
const persistedAvatarContent = cleanAvatarResponse(rawAvatarContent)

const avatarMessage: Message = {
  messageId: 'message_avatar_1',
  conversationId: conversation.conversationId,
  role: 'avatar',
  content: persistedAvatarContent,
  createdAt: conversation.startedAt,
}

type StreamOutcome = {
  /** Chunks yielded in order; an error entry is thrown at that point of the stream. */
  chunks?: (Uint8Array | TextToSpeechError)[]
  metadata?: Partial<AudioDeliveryMetadata>
}

function streamFor(input: TextToSpeechInput, outcome: StreamOutcome = {}): TextToSpeechStream {
  const chunks = outcome.chunks ?? [Uint8Array.from([1, 2]), Uint8Array.from([3])]
  async function* audio(): AsyncGenerator<Uint8Array> {
    for (const chunk of chunks) {
      await Promise.resolve()
      if (chunk instanceof TextToSpeechError) throw chunk
      yield chunk
    }
  }
  return {
    audio: audio(),
    metadata: {
      requestId: input.requestId,
      messageId: input.messageId,
      format: input.format,
      ...outcome.metadata,
    },
  }
}

async function drain(stream: TextToSpeechStream): Promise<number[]> {
  const bytes: number[] = []
  for await (const chunk of stream.audio) bytes.push(...chunk)
  return bytes
}

function createAdapter(
  outcome?: StreamOutcome | TextToSpeechError,
  options: { defaultVoiceId?: string } = { defaultVoiceId: 'provider-default' },
): ITextToSpeechAdapter & {
  inputs: TextToSpeechInput[]
  defaultLanguages: (string | undefined)[]
} {
  const inputs: TextToSpeechInput[] = []
  const defaultLanguages: (string | undefined)[] = []
  const synthesize = vi
    .fn<ITextToSpeechAdapter['synthesize']>()
    .mockImplementation((input: TextToSpeechInput, _options?: TextToSpeechOptions) => {
      inputs.push(input)
      if (outcome instanceof TextToSpeechError) return Promise.reject(outcome)
      return Promise.resolve(streamFor(input, outcome))
    })
  return {
    provider: 'gradium',
    synthesize,
    listVoices: () => Promise.resolve([]),
    getDefaultVoiceId: (language?: string) => {
      defaultLanguages.push(language)
      return Promise.resolve(options.defaultVoiceId)
    },
    inputs,
    defaultLanguages,
  }
}

function createUseCase(
  args: {
    avatarConfig?: AvatarConfig
    scenarioConfig?: Scenario
    message?: Message
    adapter?: ITextToSpeechAdapter
    providers?: TextToSpeechProviders
  } = {},
): {
  useCase: SynthesizeMessageAudioUseCase
  messages: InMemoryMessageRepository
  adapter: ITextToSpeechAdapter & {
    inputs: TextToSpeechInput[]
    defaultLanguages: (string | undefined)[]
  }
} {
  const adapter = args.adapter ?? createAdapter()
  const messages = new InMemoryMessageRepository([args.message ?? avatarMessage])
  const useCase = new SynthesizeMessageAudioUseCase(
    new InMemoryConversationRepository([conversation]),
    messages,
    new InMemoryAvatarRepository([args.avatarConfig ?? avatar]),
    new InMemoryScenarioRepository([args.scenarioConfig ?? scenario]),
    args.providers ?? new TextToSpeechProviders([adapter], 'gradium'),
  )
  return {
    useCase,
    messages,
    adapter: adapter as ITextToSpeechAdapter & {
      inputs: TextToSpeechInput[]
      defaultLanguages: (string | undefined)[]
    },
  }
}

// eslint-disable-next-line max-lines-per-function
describe('SynthesizeMessageAudioUseCase', () => {
  it('passes the persisted cleaned Avatar content exactly and does not persist audio', async () => {
    const { useCase, messages, adapter } = createUseCase()

    await useCase.execute({
      conversationId: conversation.conversationId,
      messageId: avatarMessage.messageId,
      requestId: 'request_1',
      format: 'audio/wav',
    })

    expect(adapter.inputs[0]).toEqual({
      text: persistedAvatarContent,
      voiceId: 'avatar-override',
      format: 'audio/wav',
      requestId: 'request_1',
      messageId: avatarMessage.messageId,
    })
    await expect(messages.findByConversationId(conversation.conversationId)).resolves.toEqual([
      avatarMessage,
    ])
  })

  it('falls back from the Avatar voice to the Scenario voice', async () => {
    const avatarWithoutVoice = { ...avatar }
    delete avatarWithoutVoice.voiceConfig
    const { useCase, adapter } = createUseCase({ avatarConfig: avatarWithoutVoice })

    await useCase.execute({
      conversationId: conversation.conversationId,
      messageId: avatarMessage.messageId,
      requestId: 'request_2',
    })

    expect(adapter.inputs[0]?.voiceId).toBe('scenario-default')
    expect(adapter.defaultLanguages).toEqual([])
  })

  it("uses the provider's default voice for the Scenario language when none is selected", async () => {
    const avatarWithoutVoice = { ...avatar }
    delete avatarWithoutVoice.voiceConfig
    const scenarioWithoutVoice: Scenario = { ...scenario, language: 'fr-CH' }
    delete scenarioWithoutVoice.voiceConfig
    const { useCase, adapter } = createUseCase({
      avatarConfig: avatarWithoutVoice,
      scenarioConfig: scenarioWithoutVoice,
    })

    await useCase.execute({
      conversationId: conversation.conversationId,
      messageId: avatarMessage.messageId,
      requestId: 'request_default',
    })

    expect(adapter.defaultLanguages).toEqual(['fr-CH'])
    expect(adapter.inputs[0]?.voiceId).toBe('provider-default')
  })

  it('fails with no_voice_available when the provider has no default voice', async () => {
    const avatarWithoutVoice = { ...avatar }
    delete avatarWithoutVoice.voiceConfig
    const scenarioWithoutVoice = { ...scenario }
    delete scenarioWithoutVoice.voiceConfig
    const { useCase } = createUseCase({
      avatarConfig: avatarWithoutVoice,
      scenarioConfig: scenarioWithoutVoice,
      adapter: createAdapter(undefined, {}),
    })

    await expect(
      useCase.execute({
        conversationId: conversation.conversationId,
        messageId: avatarMessage.messageId,
        requestId: 'request_3',
      }),
    ).rejects.toMatchObject({
      failure: { code: 'invalid_configuration', reason: 'no_voice_available' },
    })
  })

  it('uses the provider a scenario picks even when there is no default provider', async () => {
    const avatarWithoutVoice = { ...avatar }
    delete avatarWithoutVoice.voiceConfig
    const adapter = createAdapter()
    const { useCase } = createUseCase({
      avatarConfig: avatarWithoutVoice,
      scenarioConfig: { ...scenario, voiceConfig: { provider: 'gradium' } },
      providers: new TextToSpeechProviders([adapter], null),
    })

    await useCase.execute({
      conversationId: conversation.conversationId,
      messageId: avatarMessage.messageId,
      requestId: 'request_scenario_provider',
    })

    expect(adapter.inputs[0]?.voiceId).toBe('provider-default')
    expect(adapter.defaultLanguages).toEqual([scenario.language])
  })

  it('reports provider_unavailable when no provider has credentials', async () => {
    const { useCase, adapter } = createUseCase({ providers: new TextToSpeechProviders() })

    await expect(
      useCase.execute({
        conversationId: conversation.conversationId,
        messageId: avatarMessage.messageId,
        requestId: 'request_disabled',
      }),
    ).rejects.toMatchObject({ failure: { code: 'provider_unavailable' } })
    expect(adapter.inputs).toEqual([])
  })

  it('keeps provider failures isolated from the persisted message', async () => {
    const adapter = createAdapter(new TextToSpeechError({ code: 'rate_limited', retryable: true }))
    const { useCase, messages } = createUseCase({ adapter })

    await expect(
      useCase.execute({
        conversationId: conversation.conversationId,
        messageId: avatarMessage.messageId,
        requestId: 'request_4',
      }),
    ).rejects.toMatchObject({ failure: { code: 'rate_limited' } })
    await expect(messages.findByConversationId(conversation.conversationId)).resolves.toEqual([
      avatarMessage,
    ])
  })

  it('keeps repeated concurrent requests associated with the same message', async () => {
    const { useCase, adapter } = createUseCase()

    const [first, second] = await Promise.all([
      useCase.execute({
        conversationId: conversation.conversationId,
        messageId: avatarMessage.messageId,
        requestId: 'request_concurrent_1',
      }),
      useCase.execute({
        conversationId: conversation.conversationId,
        messageId: avatarMessage.messageId,
        requestId: 'request_concurrent_2',
      }),
    ])

    expect(adapter.inputs.map((input) => input.requestId)).toEqual([
      'request_concurrent_1',
      'request_concurrent_2',
    ])
    expect(first.metadata.messageId).toBe(avatarMessage.messageId)
    expect(second.metadata.messageId).toBe(avatarMessage.messageId)
    expect(first.audio).not.toBe(second.audio)
  })

  it('rejects an adapter stream with mismatched identity', async () => {
    const adapter = createAdapter({ metadata: { requestId: 'other-request' } })
    const { useCase } = createUseCase({ adapter })

    await expect(
      useCase.execute({
        conversationId: conversation.conversationId,
        messageId: avatarMessage.messageId,
        requestId: 'request_5',
      }),
    ).rejects.toMatchObject({
      failure: { code: 'invalid_provider_output', reason: 'identity_mismatch' },
    })
  })

  it('rejects missing conversations and non-Avatar messages before synthesis', async () => {
    const adapter = createAdapter()
    const { useCase } = createUseCase({
      message: { ...avatarMessage, role: 'user', messageId: 'message_user_1' },
      adapter,
    })

    await expect(
      useCase.execute({
        conversationId: 'conversation_missing',
        messageId: avatarMessage.messageId,
        requestId: 'request_6',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      useCase.execute({
        conversationId: conversation.conversationId,
        messageId: 'message_user_1',
        requestId: 'request_7',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(adapter.inputs).toHaveLength(0)
  })

  it('streams the adapter audio in order', async () => {
    const { useCase } = createUseCase()

    const stream = await useCase.execute({
      conversationId: conversation.conversationId,
      messageId: avatarMessage.messageId,
      requestId: 'request_stream',
      format: 'audio/pcm',
    })

    expect(stream.metadata).toEqual({
      requestId: 'request_stream',
      messageId: avatarMessage.messageId,
      format: 'audio/pcm',
    })
    await expect(drain(stream)).resolves.toEqual([1, 2, 3])
  })

  it('rejects an empty adapter stream before the caller starts streaming', async () => {
    const { useCase } = createUseCase({ adapter: createAdapter({ chunks: [] }) })

    await expect(
      useCase.execute({
        conversationId: conversation.conversationId,
        messageId: avatarMessage.messageId,
        requestId: 'request_empty',
      }),
    ).rejects.toMatchObject({ failure: { code: 'invalid_provider_output', reason: 'empty' } })
  })

  it('rejects oversized adapter streams while streaming', async () => {
    const adapter = createAdapter({ chunks: [new Uint8Array(3), new Uint8Array(3)] })
    const useCase = new SynthesizeMessageAudioUseCase(
      new InMemoryConversationRepository([conversation]),
      new InMemoryMessageRepository([avatarMessage]),
      new InMemoryAvatarRepository([avatar]),
      new InMemoryScenarioRepository([scenario]),
      new TextToSpeechProviders([adapter], 'gradium'),
      4,
    )

    const stream = await useCase.execute({
      conversationId: conversation.conversationId,
      messageId: avatarMessage.messageId,
      requestId: 'request_oversized',
    })

    await expect(drain(stream)).rejects.toMatchObject({
      failure: { code: 'invalid_provider_output', reason: 'oversized' },
    })
  })
})

// eslint-disable-next-line max-lines-per-function
describe('SynthesizeMessageAudioUseCase debug events', () => {
  function createWithEvents(adapter: ITextToSpeechAdapter): {
    useCase: SynthesizeMessageAudioUseCase
    events: InMemoryEventLogRepository
  } {
    const events = new InMemoryEventLogRepository()
    const useCase = new SynthesizeMessageAudioUseCase(
      new InMemoryConversationRepository([conversation]),
      new InMemoryMessageRepository([avatarMessage]),
      new InMemoryAvatarRepository([avatar]),
      new InMemoryScenarioRepository([scenario]),
      new TextToSpeechProviders([adapter], 'gradium'),
      undefined,
      events,
    )
    return { useCase, events }
  }

  it('records time to first audio and total time once the stream ends', async () => {
    const { useCase, events } = createWithEvents(createAdapter())

    const stream = await useCase.execute({
      conversationId: conversation.conversationId,
      messageId: avatarMessage.messageId,
      requestId: 'request_tts',
    })
    expect(events.getAll()).toEqual([])
    await drain(stream)

    expect(events.getAll()).toEqual([
      expect.objectContaining({
        sessionId: conversation.sessionId,
        type: 'message_audio_synthesized',
        correlationId: 'request_tts',
        payload: expect.objectContaining({
          messageId: avatarMessage.messageId,
          provider: 'gradium',
          characterCount: persistedAvatarContent.length,
          byteLength: 3,
          firstAudioMs: expect.any(Number) as number,
          latencyMs: expect.any(Number) as number,
        }) as unknown,
      }),
    ])
  })

  it('records a failure when the stream breaks after the first audio', async () => {
    const { useCase, events } = createWithEvents(
      createAdapter({
        chunks: [
          Uint8Array.from([1]),
          new TextToSpeechError({ code: 'provider_unavailable', retryable: true }),
        ],
      }),
    )

    const stream = await useCase.execute({
      conversationId: conversation.conversationId,
      messageId: avatarMessage.messageId,
      requestId: 'request_broken',
    })

    await expect(drain(stream)).rejects.toMatchObject({
      failure: { code: 'provider_unavailable' },
    })
    expect(events.getAll()).toEqual([
      expect.objectContaining({
        type: 'message_audio_failed',
        payload: expect.objectContaining({ errorCode: 'provider_unavailable' }) as unknown,
      }),
    ])
  })

  it('records a cancellation when the caller stops streaming early', async () => {
    const { useCase, events } = createWithEvents(createAdapter())

    const stream = await useCase.execute({
      conversationId: conversation.conversationId,
      messageId: avatarMessage.messageId,
      requestId: 'request_abandoned',
    })
    const chunks = stream.audio[Symbol.asyncIterator]()
    await chunks.next()
    await chunks.return?.()

    expect(events.getAll()).toEqual([
      expect.objectContaining({
        type: 'message_audio_failed',
        payload: expect.objectContaining({ errorCode: 'cancelled' }) as unknown,
      }),
    ])
  })

  it('records a failed synthesis with its failure code', async () => {
    const { useCase, events } = createWithEvents(
      createAdapter(new TextToSpeechError({ code: 'rate_limited', retryable: true })),
    )

    await expect(
      useCase.execute({
        conversationId: conversation.conversationId,
        messageId: avatarMessage.messageId,
        requestId: 'request_tts',
      }),
    ).rejects.toBeInstanceOf(TextToSpeechError)

    expect(events.getAll()).toEqual([
      expect.objectContaining({
        type: 'message_audio_failed',
        payload: expect.objectContaining({ errorCode: 'rate_limited' }) as unknown,
      }),
    ])
  })
})

import {
  TextToSpeechError,
  TEXT_TO_SPEECH_LIMITS,
  validateTextToSpeechResult,
  type ITextToSpeechAdapter,
} from '../../ports/ITextToSpeechAdapter.js'
import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'
import type { IMessageRepository } from '../../ports/IMessageRepository.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import { DomainError } from '../../../domain/errors.js'
import { selectVoice } from '../../../domain/voice/voice-configuration.js'
import type { TextToSpeechProviders } from '../../voice/text-to-speech-providers.js'
import type { TextToSpeechResult } from '../../ports/ITextToSpeechAdapter.js'
import type { SynthesizeMessageAudioInput } from './synthesize-message-audio.types.js'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'

const DEFAULT_AUDIO_OUTPUT_FORMAT = 'audio/wav' as const

export class SynthesizeMessageAudioUseCase {
  constructor(
    private readonly conversationRepository: IConversationRepository,
    private readonly messageRepository: IMessageRepository,
    private readonly avatarRepository: IAvatarRepository,
    private readonly scenarioRepository: IScenarioRepository,
    private readonly textToSpeechProviders: TextToSpeechProviders,
    private readonly maxOutputBytes = TEXT_TO_SPEECH_LIMITS.maxOutputBytes,
    private readonly eventLogRepository?: IEventLogRepository,
  ) {}

  async execute(input: SynthesizeMessageAudioInput): Promise<TextToSpeechResult> {
    const normalized = validateInput(input)
    const conversation = await this.conversationRepository.findById(normalized.conversationId)
    if (conversation === null) {
      throw new DomainError('NOT_FOUND', `Conversation ${normalized.conversationId} was not found.`)
    }

    const message = (
      await this.messageRepository.findByConversationId(conversation.conversationId)
    ).find((candidate) => candidate.messageId === normalized.messageId)
    if (message === undefined || message.conversationId !== conversation.conversationId) {
      throw new DomainError('NOT_FOUND', `Message ${normalized.messageId} was not found.`)
    }
    if (message.role !== 'avatar') {
      throw new DomainError(
        'CONFLICT',
        `Message ${normalized.messageId} is not an Avatar message and cannot be synthesized.`,
      )
    }
    if (message.content.trim().length === 0) {
      throw new TextToSpeechError({
        code: 'invalid_request',
        reason: 'empty_text',
        retryable: false,
      })
    }

    const avatar = await this.avatarRepository.findById(conversation.avatarId)
    if (avatar === null) {
      throw new DomainError('NOT_FOUND', `Avatar ${conversation.avatarId} was not found.`)
    }
    const scenario = await this.scenarioRepository.findById(avatar.scenarioId)
    if (scenario === null) {
      throw new DomainError('NOT_FOUND', `Scenario ${avatar.scenarioId} was not found.`)
    }
    const voice = await this.resolveVoice(scenario, avatar)

    return await this.synthesizeWithEvent(
      { sessionId: conversation.sessionId, conversationId: conversation.conversationId },
      message,
      voice,
      normalized,
    )
  }

  private async synthesizeWithEvent(
    conversation: { sessionId: string; conversationId: string },
    message: { messageId: string; content: string },
    voice: ResolvedVoice,
    normalized: ReturnType<typeof validateInput>,
  ): Promise<TextToSpeechResult> {
    const startedAt = Date.now()
    const event = {
      sessionId: conversation.sessionId,
      correlationId: normalized.requestId,
      conversationId: conversation.conversationId,
      messageId: message.messageId,
      characterCount: message.content.length,
      provider: voice.adapter.provider,
    }
    try {
      const result = await this.synthesize(message, voice, normalized)
      await this.recordEvent('message_audio_synthesized', event, {
        latencyMs: Date.now() - startedAt,
        byteLength: result.metadata.byteLength,
        ...(result.metadata.durationMs === undefined
          ? {}
          : { audioDurationMs: result.metadata.durationMs }),
      })
      return result
    } catch (error) {
      await this.recordEvent('message_audio_failed', event, {
        latencyMs: Date.now() - startedAt,
        errorCode: error instanceof TextToSpeechError ? error.failure.code : 'synthesis_failed',
      })
      throw error
    }
  }

  private async synthesize(
    message: { messageId: string; content: string },
    voice: ResolvedVoice,
    normalized: ReturnType<typeof validateInput>,
  ): Promise<TextToSpeechResult> {
    const result = await voice.adapter.synthesize(
      {
        text: message.content,
        voiceId: voice.voiceId,
        format: normalized.format,
        requestId: normalized.requestId,
        messageId: message.messageId,
      },
      { ...(normalized.signal === undefined ? {} : { signal: normalized.signal }) },
    )
    return validateTextToSpeechResult(
      result,
      { requestId: normalized.requestId, messageId: message.messageId, format: normalized.format },
      this.maxOutputBytes,
    )
  }

  // Lets the debug timeline show how long the spoken reply took; never blocks or fails synthesis.
  private async recordEvent(
    type: 'message_audio_synthesized' | 'message_audio_failed',
    event: {
      sessionId: string
      correlationId: string
      conversationId: string
      messageId: string
      characterCount: number
      provider: string
    },
    outcome: Record<string, unknown>,
  ): Promise<void> {
    if (this.eventLogRepository === undefined) return
    const { sessionId, correlationId, ...payload } = event
    try {
      await this.eventLogRepository.append({
        sessionId,
        type,
        severity: type === 'message_audio_failed' ? 'error' : 'info',
        correlationId,
        payload: { ...payload, ...outcome },
      })
    } catch (error) {
      console.error('[synthesize-message-audio] Event log append failed:', error)
    }
  }

  /**
   * Avatar provider → scenario provider → default provider; then avatar voice → scenario voice →
   * that provider's default voice for the scenario language.
   */
  private async resolveVoice(scenario: Scenario, avatar: AvatarConfig): Promise<ResolvedVoice> {
    const providers = this.textToSpeechProviders
    const selection = selectVoice(
      scenario.voiceConfig,
      avatar.voiceConfig,
      providers.available,
      providers.defaultProvider,
    )
    const adapter = selection === undefined ? undefined : providers.get(selection.provider)
    if (selection === undefined || adapter === undefined) {
      throw new TextToSpeechError({ code: 'provider_unavailable', retryable: false })
    }
    const voiceId = selection.voiceId ?? (await adapter.getDefaultVoiceId(scenario.language))
    if (voiceId === undefined) {
      throw new TextToSpeechError({
        code: 'invalid_configuration',
        reason: 'no_voice_available',
        retryable: false,
      })
    }
    return { adapter, voiceId }
  }
}

type ResolvedVoice = { adapter: ITextToSpeechAdapter; voiceId: string }

function validateInput(
  input: SynthesizeMessageAudioInput,
): Required<
  Pick<SynthesizeMessageAudioInput, 'conversationId' | 'messageId' | 'requestId' | 'format'>
> &
  Pick<SynthesizeMessageAudioInput, 'signal'> {
  const conversationId = input.conversationId.trim()
  const messageId = input.messageId.trim()
  const requestId = input.requestId.trim()
  if (conversationId.length === 0 || messageId.length === 0 || requestId.length === 0) {
    throw new DomainError(
      'VALIDATION_ERROR',
      'conversationId, messageId, and requestId are required.',
    )
  }
  return {
    conversationId,
    messageId,
    requestId,
    format: input.format ?? DEFAULT_AUDIO_OUTPUT_FORMAT,
    ...(input.signal === undefined ? {} : { signal: input.signal }),
  }
}

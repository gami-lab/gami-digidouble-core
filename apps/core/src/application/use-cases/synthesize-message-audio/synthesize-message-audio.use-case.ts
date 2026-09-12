import {
  TextToSpeechError,
  TEXT_TO_SPEECH_LIMITS,
  validateTextToSpeechResult,
  type ITextToSpeechAdapter,
} from '../../ports/ITextToSpeechAdapter.js'
import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { IMessageRepository } from '../../ports/IMessageRepository.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import { DomainError } from '../../../domain/errors.js'
import { resolveVoiceConfiguration } from '../../../domain/voice/voice-configuration.js'
import type { TextToSpeechResult } from '../../ports/ITextToSpeechAdapter.js'
import type { SynthesizeMessageAudioInput } from './synthesize-message-audio.types.js'

const DEFAULT_AUDIO_OUTPUT_FORMAT = 'audio/wav' as const

export class SynthesizeMessageAudioUseCase {
  constructor(
    private readonly conversationRepository: IConversationRepository,
    private readonly messageRepository: IMessageRepository,
    private readonly avatarRepository: IAvatarRepository,
    private readonly scenarioRepository: IScenarioRepository,
    private readonly textToSpeechAdapter: ITextToSpeechAdapter,
    private readonly maxOutputBytes = TEXT_TO_SPEECH_LIMITS.maxOutputBytes,
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
    const voice = resolveVoiceConfiguration(scenario.voiceConfig, avatar.voiceConfig)
    if (voice === undefined) {
      throw new TextToSpeechError({
        code: 'invalid_configuration',
        reason: 'missing_voice_configuration',
        retryable: false,
      })
    }

    const result = await this.textToSpeechAdapter.synthesize(
      {
        text: message.content,
        voice,
        format: normalized.format,
        requestId: normalized.requestId,
        messageId: message.messageId,
      },
      { ...(normalized.signal === undefined ? {} : { signal: normalized.signal }) },
    )
    return validateTextToSpeechResult(
      result,
      {
        requestId: normalized.requestId,
        messageId: message.messageId,
        format: normalized.format,
      },
      this.maxOutputBytes,
    )
  }
}

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

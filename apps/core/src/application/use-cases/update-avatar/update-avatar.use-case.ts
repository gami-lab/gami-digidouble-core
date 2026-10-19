import type { IAvatarRepository, UpdateAvatarParams } from '../../ports/IAvatarRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type { UpdateAvatarInput, UpdateAvatarOutput } from './update-avatar.types.js'
import { toAvatarSummary } from '../shared/avatar-summary.js'
import { normalizeVoiceConfigurationMutation } from '../../../domain/voice/voice-configuration.js'
import { applyPresentationMutation } from '../../../domain/presentation/presentation.js'
import type { IMediaAssetRepository } from '../../ports/IMediaAssetRepository.js'
import { assertPresentationMedia } from '../../services/media/media-references.js'

function buildUpdates(input: UpdateAvatarInput): UpdateAvatarParams {
  const { name, personaPrompt, tone, description, adjustments, llmOverride, status } = input
  const voiceConfig = normalizeVoiceConfigurationMutation(input.config, input.voiceConfig, true)
  return {
    ...(name !== undefined ? { name } : {}),
    ...(personaPrompt !== undefined ? { personaPrompt } : {}),
    ...(tone !== undefined ? { tone } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(adjustments !== undefined ? { adjustments } : {}),
    ...(llmOverride !== undefined ? { llmOverride } : {}),
    ...(voiceConfig !== undefined ? { voiceConfig } : {}),
    ...(status !== undefined ? { status } : {}),
  }
}

export class UpdateAvatarUseCase {
  constructor(
    private readonly avatarRepository: IAvatarRepository,
    private readonly mediaAssetRepository: IMediaAssetRepository,
  ) {}

  async execute(input: UpdateAvatarInput): Promise<UpdateAvatarOutput> {
    const updates = buildUpdates(input)

    if (
      Object.keys(updates).length === 0 &&
      input.config === undefined &&
      input.presentation === undefined
    ) {
      throw new DomainError('INVALID_INPUT', 'At least one field must be provided for update')
    }

    const existing = await this.avatarRepository.findById(input.avatarId)
    if (existing === null) throw new DomainError('NOT_FOUND', 'Avatar not found')
    if (updates.status === 'active' && existing.computedTraits === undefined) {
      throw new DomainError(
        'VALIDATION_ERROR',
        'An Avatar must be prepared before it can be active.',
      )
    }
    if (input.config !== undefined || input.presentation !== undefined) {
      updates.config = applyPresentationMutation(
        'avatar',
        input.config,
        existing.config,
        input.presentation,
      )
      await assertPresentationMedia(
        this.mediaAssetRepository,
        'avatar',
        existing.scenarioId,
        updates.config,
      )
    }
    const avatar = await this.avatarRepository.update(input.avatarId, updates)
    return { avatar: toAvatarSummary(avatar) }
  }
}

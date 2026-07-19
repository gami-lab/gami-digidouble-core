import type { IAvatarRepository, UpdateAvatarParams } from '../../ports/IAvatarRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type { AvatarSummary } from '@gami/shared'
import type { UpdateAvatarInput, UpdateAvatarOutput } from './update-avatar.types.js'

function buildUpdates(input: UpdateAvatarInput): UpdateAvatarParams {
  const { name, personaPrompt, tone, description, adjustments, llmOverride, config, status } = input
  return {
    ...(name !== undefined ? { name } : {}),
    ...(personaPrompt !== undefined ? { personaPrompt } : {}),
    ...(tone !== undefined ? { tone } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(adjustments !== undefined ? { adjustments } : {}),
    ...(llmOverride !== undefined ? { llmOverride } : {}),
    ...(config !== undefined ? { config } : {}),
    ...(status !== undefined ? { status } : {}),
  }
}

export class UpdateAvatarUseCase {
  constructor(private readonly avatarRepository: IAvatarRepository) {}

  async execute(input: UpdateAvatarInput): Promise<UpdateAvatarOutput> {
    const updates = buildUpdates(input)

    if (Object.keys(updates).length === 0) {
      throw new DomainError('INVALID_INPUT', 'At least one field must be provided for update')
    }

    const avatar = await this.avatarRepository.update(input.avatarId, updates)
    return { avatar: mapAvatarOutput(avatar) }
  }
}

function mapAvatarOutput(avatar: Awaited<ReturnType<IAvatarRepository['update']>>): AvatarSummary {
  return {
    avatarId: avatar.avatarId,
    scenarioId: avatar.scenarioId,
    name: avatar.name,
    status: avatar.status,
    personaPrompt: avatar.personaPrompt,
    ...(avatar.tone !== undefined ? { tone: avatar.tone } : {}),
    ...(avatar.description !== undefined ? { description: avatar.description } : {}),
    ...(avatar.adjustments !== undefined ? { adjustments: avatar.adjustments } : {}),
    ...(avatar.llmOverride !== undefined ? { llmOverride: avatar.llmOverride } : {}),
    computedTraits: avatar.computedTraits ?? null,
    config: avatar.config,
    createdAt: avatar.createdAt,
    updatedAt: avatar.updatedAt,
  }
}

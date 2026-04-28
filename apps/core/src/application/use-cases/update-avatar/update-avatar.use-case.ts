import type { IAvatarRepository, UpdateAvatarParams } from '../../ports/IAvatarRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type { UpdateAvatarInput, UpdateAvatarOutput } from './update-avatar.types.js'

function buildUpdates(input: UpdateAvatarInput): UpdateAvatarParams {
  const { name, personaPrompt, tone, description, adjustments, config, status } = input
  return {
    ...(name !== undefined ? { name } : {}),
    ...(personaPrompt !== undefined ? { personaPrompt } : {}),
    ...(tone !== undefined ? { tone } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(adjustments !== undefined ? { adjustments } : {}),
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
    return { avatar }
  }
}

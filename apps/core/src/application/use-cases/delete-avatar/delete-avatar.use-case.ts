import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type { DeleteAvatarInput, DeleteAvatarOutput } from './delete-avatar.types.js'

export class DeleteAvatarUseCase {
  constructor(
    private readonly avatarRepository: IAvatarRepository,
    private readonly sessionRepository: ISessionRepository,
  ) {}

  async execute(input: DeleteAvatarInput): Promise<DeleteAvatarOutput> {
    const avatar = await this.avatarRepository.findById(input.avatarId)
    if (avatar === null) {
      throw new DomainError('NOT_FOUND', 'Avatar not found')
    }

    const activeSessions = await this.sessionRepository.countActiveByScenarioId(avatar.scenarioId)
    if (activeSessions > 0) {
      throw new DomainError(
        'CONFLICT',
        'Avatar cannot be deleted while the scenario has active sessions.',
      )
    }

    await this.avatarRepository.delete(input.avatarId)
    return { avatarId: input.avatarId, deleted: true }
  }
}

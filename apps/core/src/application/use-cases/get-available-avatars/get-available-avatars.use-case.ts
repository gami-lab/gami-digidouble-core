import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IMediaAssetRepository } from '../../ports/IMediaAssetRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type {
  GetAvailableAvatarsInput,
  GetAvailableAvatarsOutput,
} from './get-available-avatars.types.js'
import { toAvailableAvatarSummary } from '../shared/avatar-summary.js'
import { readPresentation } from '../../../domain/presentation/presentation.js'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import { toPublicAvatarPresentation } from '../../services/media/public-presentation.js'
import { createPublicMediaLookup } from '../../services/media/media-asset-projection.js'

export class GetAvailableAvatarsUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly avatarRepository: IAvatarRepository,
    private readonly mediaAssetRepository: IMediaAssetRepository,
  ) {}

  async execute(input: GetAvailableAvatarsInput): Promise<GetAvailableAvatarsOutput> {
    const session = await this.sessionRepository.findById(input.sessionId)
    if (session === null) {
      throw new DomainError('NOT_FOUND', `Session ${input.sessionId} was not found.`)
    }

    const avatars = (await this.avatarRepository.listByScenarioId(session.scenarioId)).filter(
      (avatar) => avatar.status === 'active',
    )
    const availableAvatars = avatars.filter((avatar) =>
      session.unlockedAvatarIds.includes(avatar.avatarId),
    )

    return {
      sessionId: session.sessionId,
      currentAvatarId: session.activeAvatarId ?? null,
      avatars: await Promise.all(availableAvatars.map((avatar) => this.toSummary(avatar))),
    }
  }

  private async toSummary(avatar: AvatarConfig) {
    const presentation = readPresentation('avatar', avatar.config)
    return toAvailableAvatarSummary(
      avatar,
      presentation === undefined
        ? undefined
        : await toPublicAvatarPresentation(
            avatar.scenarioId,
            presentation,
            createPublicMediaLookup(this.mediaAssetRepository),
          ),
    )
  }
}

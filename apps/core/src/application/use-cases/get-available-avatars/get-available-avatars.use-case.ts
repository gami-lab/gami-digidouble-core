import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type {
  AvatarSummary,
  GetAvailableAvatarsInput,
  GetAvailableAvatarsOutput,
} from './get-available-avatars.types.js'

export class GetAvailableAvatarsUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly avatarRepository: IAvatarRepository,
  ) {}

  async execute(input: GetAvailableAvatarsInput): Promise<GetAvailableAvatarsOutput> {
    const session = await this.sessionRepository.findById(input.sessionId)
    if (session === null) {
      throw new DomainError('NOT_FOUND', `Session ${input.sessionId} was not found.`)
    }

    const avatars = (await this.avatarRepository.listByScenarioId(session.scenarioId)).filter(
      (avatar) => avatar.status === 'active',
    )
    const availableAvatars =
      session.unlockedAvatarIds === undefined
        ? avatars
        : avatars.filter((avatar) => session.unlockedAvatarIds?.includes(avatar.avatarId))

    return {
      sessionId: session.sessionId,
      currentAvatarId: session.activeAvatarId ?? null,
      avatars: availableAvatars.map(mapAvatarSummary),
    }
  }
}

function mapAvatarSummary(avatar: AvatarConfig): AvatarSummary {
  return {
    avatarId: avatar.avatarId,
    scenarioId: avatar.scenarioId,
    name: avatar.name,
    status: avatar.status,
    personaPrompt: avatar.personaPrompt,
    ...(avatar.tone !== undefined ? { tone: avatar.tone } : {}),
    ...(avatar.description !== undefined ? { description: avatar.description } : {}),
    ...(avatar.adjustments !== undefined ? { adjustments: avatar.adjustments } : {}),
    createdAt: avatar.createdAt,
    updatedAt: avatar.updatedAt,
  }
}

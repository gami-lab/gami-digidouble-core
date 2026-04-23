import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type {
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

    const avatars = await this.avatarRepository.listByScenarioId(session.scenarioId)

    return {
      sessionId: session.sessionId,
      currentAvatarId: session.activeAvatarId ?? null,
      avatars: avatars.map((avatar) => ({
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
      })),
    }
  }
}

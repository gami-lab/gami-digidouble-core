import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type { GetSessionInput, GetSessionOutput } from './get-session.types.js'

export class GetSessionUseCase {
  constructor(private readonly sessionRepository: ISessionRepository) {}

  async execute(input: GetSessionInput): Promise<GetSessionOutput> {
    const session = await this.sessionRepository.findById(input.sessionId)
    if (session === null) {
      throw new DomainError('NOT_FOUND', `Session ${input.sessionId} was not found.`)
    }

    return {
      session: {
        sessionId: session.sessionId,
        userId: session.userId,
        scenarioId: session.scenarioId,
        ...(session.activeAvatarId !== undefined ? { activeAvatarId: session.activeAvatarId } : {}),
        ...(session.unlockedAvatarIds !== undefined
          ? { unlockedAvatarIds: session.unlockedAvatarIds }
          : {}),
        ...(session.avatarOptions !== undefined ? { avatarOptions: session.avatarOptions } : {}),
        status: session.status,
        startedAt: session.startedAt,
        lastActivityAt: session.lastActivityAt,
        ...(session.endedAt !== undefined ? { endedAt: session.endedAt } : {}),
      },
    }
  }
}

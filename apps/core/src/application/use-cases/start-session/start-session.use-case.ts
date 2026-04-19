import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type { StartSessionInput, StartSessionOutput } from './start-session.types.js'

export class StartSessionUseCase {
  constructor(private readonly sessionRepository: ISessionRepository) {}

  async execute(input: StartSessionInput): Promise<StartSessionOutput> {
    // TODO(EPIC-X): expand to full StartSessionRequest shape (nested user, initialContext)
    const userId = input.userId.trim()
    const scenarioId = input.scenarioId.trim()

    if (userId.length === 0) {
      throw new DomainError('VALIDATION_ERROR', 'userId must be a non-empty string.')
    }
    if (scenarioId.length === 0) {
      throw new DomainError('VALIDATION_ERROR', 'scenarioId must be a non-empty string.')
    }

    const session = await this.sessionRepository.create({ userId, scenarioId })

    return {
      session: {
        sessionId: session.sessionId,
        userId: session.userId,
        scenarioId: session.scenarioId,
        status: session.status,
        startedAt: session.startedAt,
        lastActivityAt: session.lastActivityAt,
        ...(session.endedAt !== undefined ? { endedAt: session.endedAt } : {}),
      },
    }
  }
}

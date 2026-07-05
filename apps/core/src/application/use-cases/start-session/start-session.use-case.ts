import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import { DomainError } from '../../../domain/errors.js'
import { resolveInitialUnlockedAvatarIds } from '../../../domain/scenario/scenario-policy.service.js'
import type { StartSessionInput, StartSessionOutput } from './start-session.types.js'

export class StartSessionUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly scenarioRepository: IScenarioRepository,
    private readonly avatarRepository: IAvatarRepository,
  ) {}

  async execute(input: StartSessionInput): Promise<StartSessionOutput> {
    // TODO(EPIC-4.2): expand to full StartSessionRequest shape (nested user, initialContext)
    const userId = input.userId.trim()
    const scenarioId = input.scenarioId.trim()

    if (userId.length === 0) {
      throw new DomainError('VALIDATION_ERROR', 'userId must be a non-empty string.')
    }
    if (scenarioId.length === 0) {
      throw new DomainError('VALIDATION_ERROR', 'scenarioId must be a non-empty string.')
    }

    const scenario = await this.scenarioRepository.findById(scenarioId)
    if (scenario === null) {
      throw new DomainError('NOT_FOUND', 'Scenario not found')
    }

    const scenarioAvatars = await this.avatarRepository.listByScenarioId(scenarioId)
    const unlockedAvatarIds = resolveInitialUnlockedAvatarIds(
      scenario.avatarAvailability,
      scenarioAvatars,
    )
    const session = await this.sessionRepository.create({
      userId,
      scenarioId,
      ...(unlockedAvatarIds !== undefined ? { unlockedAvatarIds } : {}),
    })

    return {
      session: {
        sessionId: session.sessionId,
        userId: session.userId,
        scenarioId: session.scenarioId,
        ...(session.activeAvatarId !== undefined ? { activeAvatarId: session.activeAvatarId } : {}),
        ...(session.unlockedAvatarIds !== undefined
          ? { unlockedAvatarIds: session.unlockedAvatarIds }
          : {}),
        status: session.status,
        startedAt: session.startedAt,
        lastActivityAt: session.lastActivityAt,
        ...(session.endedAt !== undefined ? { endedAt: session.endedAt } : {}),
      },
    }
  }
}

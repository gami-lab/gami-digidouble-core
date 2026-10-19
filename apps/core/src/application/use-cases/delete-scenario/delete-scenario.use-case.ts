import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { IMediaAssetRepository } from '../../ports/IMediaAssetRepository.js'
import type { IMediaStorage } from '../../ports/IMediaStorage.js'
import { DomainError } from '../../../domain/errors.js'
import type { DeleteScenarioInput, DeleteScenarioOutput } from './delete-scenario.types.js'

export class DeleteScenarioUseCase {
  constructor(
    private readonly scenarioRepository: IScenarioRepository,
    private readonly avatarRepository: IAvatarRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly mediaAssetRepository: IMediaAssetRepository,
    private readonly mediaStorage: IMediaStorage,
  ) {}

  async execute(input: DeleteScenarioInput): Promise<DeleteScenarioOutput> {
    const scenario = await this.scenarioRepository.findById(input.scenarioId)
    if (scenario === null) {
      throw new DomainError('NOT_FOUND', 'Scenario not found')
    }

    const [avatarsCount, sessionsCount] = await Promise.all([
      this.avatarRepository.listByScenarioId(input.scenarioId).then((avatars) => avatars.length),
      this.sessionRepository.countByScenarioId(input.scenarioId),
    ])

    if (avatarsCount > 0 || sessionsCount > 0) {
      throw new DomainError(
        'CONFLICT',
        `Cannot delete scenario: ${String(avatarsCount)} avatar(s) and ${String(sessionsCount)} session(s) exist.`,
        { avatarCount: avatarsCount, sessionCount: sessionsCount },
      )
    }

    const assets = await this.mediaAssetRepository.listByScenario(input.scenarioId)
    await this.scenarioRepository.delete(input.scenarioId)
    await Promise.all(
      assets.flatMap((asset) =>
        asset.storageKey !== null ? [this.mediaStorage.delete(asset.storageKey)] : [],
      ),
    )
    return { scenarioId: input.scenarioId, deleted: true }
  }
}

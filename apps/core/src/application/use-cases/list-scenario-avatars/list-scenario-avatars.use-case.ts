import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type {
  ListScenarioAvatarsInput,
  ListScenarioAvatarsOutput,
} from './list-scenario-avatars.types.js'

export class ListScenarioAvatarsUseCase {
  constructor(
    private readonly scenarioRepository: IScenarioRepository,
    private readonly avatarRepository: IAvatarRepository,
  ) {}

  async execute(input: ListScenarioAvatarsInput): Promise<ListScenarioAvatarsOutput> {
    const scenario = await this.scenarioRepository.findById(input.scenarioId)
    if (scenario === null) {
      throw new DomainError('NOT_FOUND', 'Scenario not found')
    }

    const avatars = await this.avatarRepository.listByScenarioId(input.scenarioId)
    return {
      avatars: avatars.map((avatar) => ({
        avatarId: avatar.avatarId,
        scenarioId: avatar.scenarioId,
        name: avatar.name,
        status: avatar.status,
        personaPrompt: avatar.personaPrompt,
        ...(avatar.tone !== undefined ? { tone: avatar.tone } : {}),
        ...(avatar.description !== undefined ? { description: avatar.description } : {}),
        ...(avatar.adjustments !== undefined ? { adjustments: avatar.adjustments } : {}),
        config: avatar.config,
        createdAt: avatar.createdAt,
        updatedAt: avatar.updatedAt,
      })),
    }
  }
}

import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type {
  ListScenarioAvatarsInput,
  ListScenarioAvatarsOutput,
} from './list-scenario-avatars.types.js'
import { toAvatarSummary } from '../shared/avatar-summary.js'

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
      avatars: avatars.map(toAvatarSummary),
    }
  }
}

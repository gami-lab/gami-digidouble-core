import type { ISessionRepository, ListSessionsFilter } from '../../ports/ISessionRepository.js'
import type { ListSessionsInput, ListSessionsOutput } from './list-sessions.types.js'

export class ListSessionsUseCase {
  constructor(private readonly sessionRepository: ISessionRepository) {}

  async execute(input: ListSessionsInput): Promise<ListSessionsOutput> {
    const filter: ListSessionsFilter = {}
    if (input.scenarioId !== undefined) filter.scenarioId = input.scenarioId
    if (input.userId !== undefined) filter.userId = input.userId
    if (input.status !== undefined) filter.status = input.status
    const sessions = await this.sessionRepository.list(filter)
    return { sessions }
  }
}

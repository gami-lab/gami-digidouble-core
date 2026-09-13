import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type { GetSessionInput, GetSessionOutput } from './get-session.types.js'
import { toSessionSummary } from '../shared/entity-summaries.js'

export class GetSessionUseCase {
  constructor(private readonly sessionRepository: ISessionRepository) {}

  async execute(input: GetSessionInput): Promise<GetSessionOutput> {
    const session = await this.sessionRepository.findById(input.sessionId)
    if (session === null) {
      throw new DomainError('NOT_FOUND', `Session ${input.sessionId} was not found.`)
    }

    return { session: toSessionSummary(session) }
  }
}

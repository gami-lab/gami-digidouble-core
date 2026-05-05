import type { SessionMemorySummary } from '@gami/shared'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { IUserMemoryFactRepository } from '../../ports/IUserMemoryFactRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type { GetSessionMemoryInput, GetSessionMemoryOutput } from './get-session-memory.types.js'

export class GetSessionMemoryUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly userMemoryFactRepository?: IUserMemoryFactRepository,
  ) {}

  async execute(input: GetSessionMemoryInput): Promise<GetSessionMemoryOutput> {
    const session = await this.sessionRepository.findById(input.sessionId)
    if (session === null) {
      throw new DomainError('NOT_FOUND', `Session ${input.sessionId} was not found.`)
    }

    const summary: SessionMemorySummary = {
      sessionId: session.sessionId,
      summary: session.memorySummary ?? '',
      shortTerm: { exchangeCount: 2 },
      updatedAt: session.lastActivityAt,
    }

    if (this.userMemoryFactRepository !== undefined) {
      const facts = await this.userMemoryFactRepository.findByUserId(session.userId)
      summary.longTermFactCount = facts.length
    }

    return { memorySummary: summary }
  }
}

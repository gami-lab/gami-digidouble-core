import type { SessionMemorySummary } from '@gami/shared'
import type { ISessionMemoryRepository } from '../../ports/ISessionMemoryRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { IUserMemoryFactRepository } from '../../ports/IUserMemoryFactRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type { GetSessionMemoryInput, GetSessionMemoryOutput } from './get-session-memory.types.js'

export class GetSessionMemoryUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly userMemoryFactRepository?: IUserMemoryFactRepository,
    private readonly sessionMemoryRepository?: ISessionMemoryRepository,
  ) {}

  async execute(input: GetSessionMemoryInput): Promise<GetSessionMemoryOutput> {
    const session = await this.sessionRepository.findById(input.sessionId)
    if (session === null) {
      throw new DomainError('NOT_FOUND', `Session ${input.sessionId} was not found.`)
    }

    const workingMemory = await this.sessionMemoryRepository?.findBySessionId(session.sessionId)
    const summaryText = workingMemory?.summary ?? session.memorySummary ?? ''
    const updatedAt = workingMemory?.updatedAt ?? session.lastActivityAt

    const summary: SessionMemorySummary = {
      sessionId: session.sessionId,
      summary: summaryText,
      shortTerm: { exchangeCount: 2 },
      updatedAt,
    }

    if (this.userMemoryFactRepository !== undefined) {
      const facts = await this.userMemoryFactRepository.findByUserId(session.userId)
      summary.longTermFactCount = facts.length
    }

    return { memorySummary: summary }
  }
}

import type { IMessageRepository } from '../../ports/IMessageRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type { GetHistoryInput, GetHistoryOutput } from './get-history.types.js'

export class GetHistoryUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly messageRepository: IMessageRepository,
  ) {}

  async execute(input: GetHistoryInput): Promise<GetHistoryOutput> {
    const session = await this.sessionRepository.findById(input.sessionId)
    if (session === null) {
      throw new DomainError('NOT_FOUND', `Session ${input.sessionId} was not found.`)
    }

    const messages = await this.messageRepository.findBySessionId(input.sessionId)

    // TODO(EPIC-4.2): include session memory summary
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
      messages,
    }
  }
}

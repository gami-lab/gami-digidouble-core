import type { IMessageRepository } from '../../ports/IMessageRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type { ResetSessionInput, ResetSessionOutput } from './reset-session.types.js'

export class ResetSessionUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly messageRepository: IMessageRepository,
  ) {}

  async execute(input: ResetSessionInput): Promise<ResetSessionOutput> {
    const session = await this.sessionRepository.findById(input.sessionId)
    if (session === null) {
      throw new DomainError('NOT_FOUND', `Session ${input.sessionId} was not found.`)
    }

    const deletedMessages = await this.messageRepository.deleteBySessionId(input.sessionId)

    return {
      sessionId: input.sessionId,
      deleted: {
        messages: deletedMessages,
        sessionMemory: false, // TODO(EPIC-4.2): delete session memory when implemented
        events: 0, // TODO(EPIC-3.3): delete events when implemented
      },
    }
  }
}

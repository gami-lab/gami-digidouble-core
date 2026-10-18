import type { IConversationRepository } from '../ports/IConversationRepository.js'
import type { ISessionRepository } from '../ports/ISessionRepository.js'
import { DomainError } from '../../domain/errors.js'

/**
 * Resolves whether a player owns a session or conversation. A resource owned by someone else is
 * reported exactly like a missing one (`NOT_FOUND`), so ids never reveal that they exist.
 */
export class PlayerAccessService {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly conversationRepository: IConversationRepository,
  ) {}

  async requireSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.sessionRepository.findById(sessionId)
    if (session === null || session.userId !== userId) {
      throw new DomainError('NOT_FOUND', `Session ${sessionId} was not found.`)
    }
  }

  async requireConversation(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.conversationRepository.findById(conversationId)
    const session =
      conversation === null ? null : await this.sessionRepository.findById(conversation.sessionId)
    if (session === null || session.userId !== userId) {
      throw new DomainError('NOT_FOUND', `Conversation ${conversationId} was not found.`)
    }
  }
}

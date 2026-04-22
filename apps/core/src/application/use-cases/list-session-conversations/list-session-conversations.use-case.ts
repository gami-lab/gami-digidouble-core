import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type {
  ListSessionConversationsInput,
  ListSessionConversationsOutput,
} from './list-session-conversations.types.js'

export class ListSessionConversationsUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly conversationRepository: IConversationRepository,
  ) {}

  async execute(input: ListSessionConversationsInput): Promise<ListSessionConversationsOutput> {
    const session = await this.sessionRepository.findById(input.sessionId)
    if (session === null) {
      throw new DomainError('NOT_FOUND', `Session ${input.sessionId} was not found.`)
    }

    const conversations = await this.conversationRepository.listBySessionId(input.sessionId)
    return {
      conversations: conversations.map((conversation) => ({
        conversationId: conversation.conversationId,
        sessionId: conversation.sessionId,
        avatarId: conversation.avatarId,
        status: conversation.status,
        startedAt: conversation.startedAt,
        lastActivityAt: conversation.lastActivityAt,
        ...(conversation.endedAt !== undefined ? { endedAt: conversation.endedAt } : {}),
      })),
    }
  }
}

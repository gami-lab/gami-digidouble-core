import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { IMessageRepository } from '../../ports/IMessageRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type { ResetSessionInput, ResetSessionOutput } from './reset-session.types.js'

export class ResetSessionUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly conversationRepository: IConversationRepository,
    private readonly messageRepository: IMessageRepository,
  ) {}

  async execute(input: ResetSessionInput): Promise<ResetSessionOutput> {
    const session = await this.sessionRepository.findById(input.sessionId)
    if (session === null) {
      throw new DomainError('NOT_FOUND', `Session ${input.sessionId} was not found.`)
    }

    const conversations = await this.conversationRepository.listBySessionId(input.sessionId)
    await Promise.all(
      conversations.map((conversation) =>
        this.messageRepository.deleteByConversationId(conversation.conversationId),
      ),
    )
    await this.conversationRepository.deleteBySessionId(input.sessionId)

    try {
      const updated = await this.sessionRepository.update(input.sessionId, {
        activeAvatarId: null,
        unlockedAvatarIds: [],
        gmNotes: null,
        status: 'active',
        lastActivityAt: new Date().toISOString(),
      })
      return { session: updated }
    } catch (error) {
      throw new DomainError(
        'INTERNAL_ERROR',
        `Failed to reset session ${input.sessionId}: ${String(error)}`,
      )
    }
  }
}

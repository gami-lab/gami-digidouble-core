import type { ConversationSummary } from '@gami/shared'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type { EndConversationInput, EndConversationResponse } from './end-conversation.types.js'

const DEFAULT_END_REASON = 'operator_end'

export class EndConversationUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly conversationRepository: IConversationRepository,
  ) {}

  async execute(input: EndConversationInput): Promise<EndConversationResponse> {
    const sessionId = input.sessionId.trim()
    const conversationId = input.conversationId.trim()

    if (sessionId.length === 0) {
      throw new DomainError('VALIDATION_ERROR', 'sessionId must be a non-empty string.')
    }
    if (conversationId.length === 0) {
      throw new DomainError('VALIDATION_ERROR', 'conversationId must be a non-empty string.')
    }

    const session = await this.sessionRepository.findById(sessionId)
    if (session === null) {
      throw new DomainError('NOT_FOUND', `Session ${sessionId} was not found.`)
    }
    if (session.status !== 'active') {
      throw new DomainError('CONFLICT', 'Session is not active.')
    }

    const conversation = await this.conversationRepository.findById(conversationId)
    if (conversation === null || conversation.sessionId !== sessionId) {
      throw new DomainError(
        'NOT_FOUND',
        `Conversation ${conversationId} was not found in session ${sessionId}.`,
      )
    }
    if (conversation.status !== 'active') {
      throw new DomainError('CONFLICT', `Conversation ${conversationId} is not active.`)
    }

    const now = new Date().toISOString()
    const updatedConversation = await this.conversationRepository.update(conversationId, {
      status: 'closed',
      endedAt: now,
      lastActivityAt: now,
      reason: input.reason ?? DEFAULT_END_REASON,
    })
    await this.sessionRepository.update(sessionId, { lastActivityAt: now })

    return {
      conversation: this.toSummary(updatedConversation),
      compaction: { scheduled: true },
    }
  }

  private toSummary(conversation: {
    conversationId: string
    sessionId: string
    avatarId: string
    status: 'active' | 'closed' | 'archived'
    startedAt: string
    lastActivityAt: string
    endedAt?: string
  }): ConversationSummary {
    return {
      conversationId: conversation.conversationId,
      sessionId: conversation.sessionId,
      avatarId: conversation.avatarId,
      status: conversation.status,
      startedAt: conversation.startedAt,
      lastActivityAt: conversation.lastActivityAt,
      ...(conversation.endedAt !== undefined ? { endedAt: conversation.endedAt } : {}),
    }
  }
}

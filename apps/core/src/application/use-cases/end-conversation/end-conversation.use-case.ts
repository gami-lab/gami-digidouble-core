import crypto from 'node:crypto'
import type { ConversationSummary } from '@gami/shared'
import type { IConversationCompactionPort } from '../../ports/IConversationCompactionPort.js'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'
import type { ISessionEventPublisher } from '../../ports/ISessionEventPublisher.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type { EndConversationInput, EndConversationResponse } from './end-conversation.types.js'

const DEFAULT_END_REASON = 'operator_end'

export class EndConversationUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly conversationRepository: IConversationRepository,
    private readonly compactionPort: IConversationCompactionPort,
    private readonly eventLogRepository: IEventLogRepository,
    private readonly sessionEventPublisher?: ISessionEventPublisher,
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
    this.emitSessionClosed(sessionId, conversationId)
    void this.compactSessionMemory(sessionId, conversationId)

    return {
      conversation: this.toSummary(updatedConversation),
      compaction: { scheduled: true },
    }
  }

  private emitSessionClosed(sessionId: string, conversationId: string): void {
    if (this.sessionEventPublisher === undefined) return
    try {
      this.sessionEventPublisher.emit({
        eventId: `rev_${crypto.randomUUID()}`,
        sessionId,
        conversationId,
        type: 'runtime.session_closed',
        occurredAt: new Date().toISOString(),
        payload: { conversationId },
      })
    } catch (error: unknown) {
      console.warn('[end-conversation] Runtime event emission failed:', error)
    }
  }

  private async compactSessionMemory(sessionId: string, conversationId: string): Promise<void> {
    const requestId = crypto.randomUUID()
    await this.appendEventSafe({
      sessionId,
      type: 'memory_compaction_triggered',
      severity: 'info',
      requestId,
      payload: { sessionId, conversationId },
    })

    try {
      const compacted = await this.compactionPort.compactConversation({ sessionId, conversationId })
      await this.sessionRepository.update(sessionId, {
        memorySummary: compacted.summary,
      })
      await this.appendEventSafe({
        sessionId,
        type: 'memory_compaction_succeeded',
        severity: 'info',
        requestId,
        payload: {
          sessionId,
          conversationId,
          summaryLength: compacted.summary.length,
        },
      })
    } catch (error) {
      await this.appendEventSafe({
        sessionId,
        type: 'memory_compaction_failed',
        severity: 'error',
        requestId,
        payload: {
          sessionId,
          conversationId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      })
    }
  }

  private async appendEventSafe(args: Parameters<IEventLogRepository['append']>[0]): Promise<void> {
    try {
      await this.eventLogRepository.append(args)
    } catch (error) {
      console.error('[end-conversation] Event log append failed:', error)
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

import crypto from 'node:crypto'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'
import type { IMemoryMaintenancePort } from '../../ports/IMemoryMaintenancePort.js'
import type { ISessionEventPublisher } from '../../ports/ISessionEventPublisher.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type { EndConversationInput, EndConversationResponse } from './end-conversation.types.js'
import { toConversationSummary } from '../shared/entity-summaries.js'

const DEFAULT_END_REASON = 'operator_end'

export class EndConversationUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly conversationRepository: IConversationRepository,
    private readonly eventLogRepository: IEventLogRepository,
    private readonly memoryMaintenance?: IMemoryMaintenancePort,
    private readonly sessionEventPublisher?: ISessionEventPublisher,
    private readonly episodicMemoryService?: {
      generateForClosedConversation(input: {
        conversationId: string
        sessionId: string
        userId: string
        avatarId: string
        scenarioId: string
      }): Promise<unknown>
    },
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
    void this.runBackgroundClosePipeline({
      sessionId,
      conversationId,
      userId: session.userId,
      avatarId: conversation.avatarId,
      scenarioId: session.scenarioId,
    })

    return {
      conversation: toConversationSummary(updatedConversation),
      compaction: { scheduled: true },
    }
  }

  private async runBackgroundClosePipeline(input: {
    sessionId: string
    conversationId: string
    userId: string
    avatarId: string
    scenarioId: string
  }): Promise<void> {
    if (this.memoryMaintenance !== undefined) {
      try {
        await this.memoryMaintenance.execute({
          sessionId: input.sessionId,
          conversationId: input.conversationId,
          avatarId: input.avatarId,
          scenarioId: input.scenarioId,
          trigger: 'conversation_closed',
        })
      } catch (error: unknown) {
        console.error('[end-conversation] Background memory refresh failed:', error)
      }
    }

    await this.generateEpisodicMemory(input)
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

  private async appendEventSafe(args: Parameters<IEventLogRepository['append']>[0]): Promise<void> {
    try {
      await this.eventLogRepository.append(args)
    } catch (error) {
      console.error('[end-conversation] Event log append failed:', error)
    }
  }

  private async generateEpisodicMemory(input: {
    sessionId: string
    conversationId: string
    userId: string
    avatarId: string
    scenarioId: string
  }): Promise<void> {
    if (this.episodicMemoryService === undefined) return
    const requestId = crypto.randomUUID()
    await this.appendEventSafe({
      sessionId: input.sessionId,
      type: 'episodic_memory_generation_triggered',
      severity: 'info',
      requestId,
      payload: {
        conversationId: input.conversationId,
        avatarId: input.avatarId,
      },
    })
    try {
      await this.episodicMemoryService.generateForClosedConversation(input)
      await this.appendEventSafe({
        sessionId: input.sessionId,
        type: 'episodic_memory_generation_succeeded',
        severity: 'info',
        requestId,
        payload: {
          conversationId: input.conversationId,
          avatarId: input.avatarId,
        },
      })
    } catch (error) {
      await this.appendEventSafe({
        sessionId: input.sessionId,
        type: 'episodic_memory_generation_failed',
        severity: 'error',
        requestId,
        payload: {
          conversationId: input.conversationId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      })
    }
  }
}

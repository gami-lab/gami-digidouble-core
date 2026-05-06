import crypto from 'node:crypto'
import type { IAvatarSessionMemoryRepository } from '../ports/IAvatarSessionMemoryRepository.js'
import type { IEventLogRepository } from '../ports/IEventLogRepository.js'
import type { IMessageRepository } from '../ports/IMessageRepository.js'
import type { IMemoryMaintenancePort } from '../ports/IMemoryMaintenancePort.js'
import type { ISessionMemoryRepository } from '../ports/ISessionMemoryRepository.js'
import type { ISessionRepository } from '../ports/ISessionRepository.js'
import {
  buildAvatarWorkingMemorySummary,
  buildSessionWorkingMemorySummary,
} from '../../domain/memory/working-memory-summary.policy.js'

export class MemoryMaintenanceService implements IMemoryMaintenancePort {
  constructor(
    private readonly messageRepository: IMessageRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly sessionMemoryRepository: ISessionMemoryRepository,
    private readonly avatarSessionMemoryRepository: IAvatarSessionMemoryRepository,
    private readonly eventLogRepository: IEventLogRepository,
  ) {}

  async execute(input: {
    sessionId: string
    conversationId: string
    avatarId: string
    trigger: 'post_turn' | 'conversation_closed'
    correlationId?: string
  }): Promise<void> {
    const requestId = crypto.randomUUID()
    await this.appendEventSafe({
      sessionId: input.sessionId,
      type: 'memory_refresh_triggered',
      severity: 'info',
      requestId,
      ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
      payload: {
        sessionId: input.sessionId,
        conversationId: input.conversationId,
        avatarId: input.avatarId,
        trigger: input.trigger,
      },
    })

    try {
      const messages = await this.messageRepository.findByConversationId(input.conversationId, {
        limit: 20,
      })
      const ordered = messages
        .slice()
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      const sessionSummary = buildSessionWorkingMemorySummary(ordered)
      const avatarSummary = buildAvatarWorkingMemorySummary(ordered, input.avatarId)

      await this.sessionMemoryRepository.upsert({
        sessionId: input.sessionId,
        summary: sessionSummary,
      })
      await this.avatarSessionMemoryRepository.upsert({
        sessionId: input.sessionId,
        avatarId: input.avatarId,
        summary: avatarSummary,
      })
      await this.sessionRepository.update(input.sessionId, { memorySummary: sessionSummary })

      await this.appendEventSafe({
        sessionId: input.sessionId,
        type: 'memory_refresh_succeeded',
        severity: 'info',
        requestId,
        ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
        payload: {
          sessionId: input.sessionId,
          conversationId: input.conversationId,
          avatarId: input.avatarId,
          trigger: input.trigger,
          sessionSummaryLength: sessionSummary.length,
          avatarSummaryLength: avatarSummary.length,
          messageCount: ordered.length,
        },
      })
    } catch (error) {
      await this.appendEventSafe({
        sessionId: input.sessionId,
        type: 'memory_refresh_failed',
        severity: 'error',
        requestId,
        ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
        payload: {
          sessionId: input.sessionId,
          conversationId: input.conversationId,
          avatarId: input.avatarId,
          trigger: input.trigger,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      })
    }
  }

  private async appendEventSafe(args: Parameters<IEventLogRepository['append']>[0]): Promise<void> {
    try {
      await this.eventLogRepository.append(args)
    } catch (error) {
      console.error('[memory-maintenance] Event log append failed:', error)
    }
  }
}

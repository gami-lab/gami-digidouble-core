import crypto from 'node:crypto'
import type { IAvatarSessionMemoryRepository } from '../ports/IAvatarSessionMemoryRepository.js'
import type { IEventLogRepository } from '../ports/IEventLogRepository.js'
import type { IMessageRepository } from '../ports/IMessageRepository.js'
import type { IMemoryMaintenancePort } from '../ports/IMemoryMaintenancePort.js'
import type { ISessionMemoryRepository } from '../ports/ISessionMemoryRepository.js'
import type { ISessionRepository } from '../ports/ISessionRepository.js'
import type { IConversationWorkingMemoryRepository } from '../ports/IConversationWorkingMemoryRepository.js'
import { rewriteConversationWorkingMemory } from '../../domain/memory/conversation-working-memory.policy.js'
import { buildAvatarWorkingMemorySummary } from '../../domain/memory/working-memory-summary.policy.js'

export class MemoryMaintenanceService implements IMemoryMaintenancePort {
  constructor(
    private readonly messageRepository: IMessageRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly sessionMemoryRepository: ISessionMemoryRepository,
    private readonly avatarSessionMemoryRepository: IAvatarSessionMemoryRepository,
    private readonly conversationWorkingMemoryRepository: IConversationWorkingMemoryRepository,
    private readonly eventLogRepository: IEventLogRepository,
  ) {}

  async execute(input: {
    sessionId: string
    conversationId: string
    avatarId: string
    trigger: 'post_turn' | 'conversation_closed' | 'avatar_switch' | 'admin_trigger'
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
      const exchangeCount = countExchanges(ordered)
      if (input.trigger === 'post_turn' && exchangeCount % 3 !== 0) {
        return
      }

      const rewritten = rewriteConversationWorkingMemory(ordered)
      const avatarSummary = buildAvatarWorkingMemorySummary(ordered, input.avatarId)

      await this.conversationWorkingMemoryRepository.upsert({
        conversationId: input.conversationId,
        sessionId: input.sessionId,
        avatarId: input.avatarId,
        summary: rewritten.summary,
        unresolvedThreads: rewritten.unresolvedThreads,
        candidateFacts: rewritten.candidateFacts,
      })
      await this.sessionMemoryRepository.upsert({
        sessionId: input.sessionId,
        summary: rewritten.summary,
      })
      await this.avatarSessionMemoryRepository.upsert({
        sessionId: input.sessionId,
        avatarId: input.avatarId,
        summary: avatarSummary,
      })
      await this.sessionRepository.update(input.sessionId, { memorySummary: rewritten.summary })

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
          sessionSummaryLength: rewritten.summary.length,
          avatarSummaryLength: avatarSummary.length,
          messageCount: ordered.length,
          unresolvedThreadCount: rewritten.unresolvedThreads.length,
          candidateFactCount: rewritten.candidateFacts.length,
          exchangeCount,
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

function countExchanges(
  messages: Array<{ role: 'user' | 'avatar' | 'system'; createdAt: string; content: string }>,
): number {
  let exchanges = 0
  let pendingUser = false
  for (const message of messages) {
    if (message.role === 'user') {
      pendingUser = true
      continue
    }
    if (message.role === 'avatar' && pendingUser) {
      exchanges += 1
      pendingUser = false
    }
  }
  return exchanges
}

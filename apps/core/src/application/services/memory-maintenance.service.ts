import crypto from 'node:crypto'
import type { IAvatarSessionMemoryRepository } from '../ports/IAvatarSessionMemoryRepository.js'
import type { IEventLogRepository } from '../ports/IEventLogRepository.js'
import type { IMessageRepository } from '../ports/IMessageRepository.js'
import type { IMemoryMaintenancePort } from '../ports/IMemoryMaintenancePort.js'
import type { ISessionMemoryRepository } from '../ports/ISessionMemoryRepository.js'
import type { ISessionRepository } from '../ports/ISessionRepository.js'

const MAX_SNIPPET_LENGTH = 220

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
      const sessionSummary = buildSessionSummary(ordered)
      const avatarSummary = buildAvatarSummary(ordered, input.avatarId)

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

function buildSessionSummary(messages: Array<{ role: string; content: string }>): string {
  if (messages.length === 0) {
    return 'No exchanged messages yet.'
  }
  const userCount = messages.filter((message) => message.role === 'user').length
  const avatarCount = messages.filter((message) => message.role === 'avatar').length
  const snippets = messages
    .filter((message) => message.role === 'user' || message.role === 'avatar')
    .slice(-6)
    .map((message) => `${message.role}: ${compactText(message.content)}`)
    .join(' | ')
  return `Conversation turns: user=${String(userCount)}, avatar=${String(avatarCount)}. Recent context: ${snippets}`
}

function buildAvatarSummary(
  messages: Array<{ role: string; content: string }>,
  avatarId: string,
): string {
  const snippets = messages
    .filter((message) => message.role === 'user' || message.role === 'avatar')
    .slice(-4)
    .map((message) => `${message.role}: ${compactText(message.content)}`)
    .join(' | ')
  return `Avatar ${avatarId} recent dialogue context: ${snippets.length > 0 ? snippets : 'none'}.`
}

function compactText(content: string): string {
  const normalized = content.trim().replace(/\s+/g, ' ')
  if (normalized.length <= MAX_SNIPPET_LENGTH) return normalized
  return `${normalized.slice(0, MAX_SNIPPET_LENGTH)}...`
}

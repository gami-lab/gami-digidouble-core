import crypto from 'node:crypto'
import type { IAvatarSessionMemoryRepository } from '../ports/IAvatarSessionMemoryRepository.js'
import type { IEventLogRepository } from '../ports/IEventLogRepository.js'
import type { ILlmAdapter } from '../ports/ILlmAdapter.js'
import type { IMessageRepository } from '../ports/IMessageRepository.js'
import type { IMemoryMaintenancePort } from '../ports/IMemoryMaintenancePort.js'
import type { ISessionMemoryRepository } from '../ports/ISessionMemoryRepository.js'
import type { ISessionRepository } from '../ports/ISessionRepository.js'
import type { IConversationWorkingMemoryRepository } from '../ports/IConversationWorkingMemoryRepository.js'
import { rewriteConversationWorkingMemory } from '../../domain/memory/conversation-working-memory.policy.js'
import { buildAvatarWorkingMemorySummary } from '../../domain/memory/working-memory-summary.policy.js'

const WORKING_MEMORY_COMPACTION_SYSTEM_PROMPT = `You compact conversation memory for runtime continuity.

Rules:
- Return JSON only, with shape { summary, unresolvedThreads, candidateFacts }.
- summary must be concise and bounded (max ~700 chars), not a transcript dump.
- unresolvedThreads: 0-6 concise unresolved user threads.
- candidateFacts: 0-8 objects with { category, key, value }.
- category must be one of: conversation_signal, preference, constraint, goal, identity, context.
- key must be compact lowercase snake_case.
- value must be concise and grounded in the conversation.
- Do not invent facts.
- If there is no strong signal, return empty arrays.`

const ALLOWED_FACT_CATEGORIES = new Set([
  'conversation_signal',
  'preference',
  'constraint',
  'goal',
  'identity',
  'context',
])

export class MemoryMaintenanceService implements IMemoryMaintenancePort {
  constructor(
    private readonly messageRepository: IMessageRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly sessionMemoryRepository: ISessionMemoryRepository,
    private readonly avatarSessionMemoryRepository: IAvatarSessionMemoryRepository,
    private readonly conversationWorkingMemoryRepository: IConversationWorkingMemoryRepository,
    private readonly eventLogRepository: IEventLogRepository,
    private readonly llm?: ILlmAdapter,
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

      const rewritten = await this.rewriteWorkingMemory(ordered)
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

  private async rewriteWorkingMemory(
    messages: Array<{ role: 'user' | 'avatar' | 'system'; createdAt: string; content: string }>,
  ) {
    if (this.llm === undefined) {
      return rewriteConversationWorkingMemory(messages)
    }

    try {
      const response = await this.llm.complete({
        systemPrompt: WORKING_MEMORY_COMPACTION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildCompactionTranscript(messages) }],
        maxTokens: 500,
      })
      const parsed = parseCompactionOutput(response.content)
      if (parsed !== null) return parsed
    } catch (error) {
      safeWarn('[memory-maintenance] LLM working-memory compaction failed:', error)
    }

    return rewriteConversationWorkingMemory(messages)
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

function buildCompactionTranscript(
  messages: Array<{ role: 'user' | 'avatar' | 'system'; createdAt: string; content: string }>,
): string {
  return messages.map((message) => `${message.role}: ${message.content.trim()}`).join('\n')
}

function parseCompactionOutput(content: string): {
  summary: string
  unresolvedThreads: string[]
  candidateFacts: Array<{ category: string; key: string; value: string }>
} | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(stripMarkdownFences(content))
  } catch {
    return null
  }
  if (!isRecord(parsed)) return null

  const summary = readString(parsed['summary'])
  if (summary === null) return null

  const unresolvedThreads = readStringArray(parsed['unresolvedThreads']).slice(0, 6)
  const candidateFacts = readCandidateFacts(parsed['candidateFacts']).slice(0, 8)

  return {
    summary: summary.length > 700 ? `${summary.slice(0, 700)}...` : summary,
    unresolvedThreads,
    candidateFacts,
  }
}

function readCandidateFacts(
  value: unknown,
): Array<{ category: string; key: string; value: string }> {
  if (!Array.isArray(value)) return []

  const facts: Array<{ category: string; key: string; value: string }> = []
  for (const item of value) {
    if (!isRecord(item)) continue
    const category = readString(item['category'])
    const key = readString(item['key'])
    const factValue = readString(item['value'])
    if (category === null || key === null || factValue === null) continue
    if (!ALLOWED_FACT_CATEGORIES.has(category)) continue
    facts.push({ category, key, value: factValue })
  }
  return facts
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(readString).filter((item): item is string => item !== null)
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function stripMarkdownFences(content: string): string {
  const trimmed = content.trim()
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed)
  return match?.[1]?.trim() ?? trimmed
}

function safeWarn(message: string, error: unknown): void {
  try {
    console.warn(message, error)
  } catch {
    // Never let diagnostics break memory maintenance flow.
  }
}

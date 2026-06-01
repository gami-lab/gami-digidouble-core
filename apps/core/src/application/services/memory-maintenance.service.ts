import crypto from 'node:crypto'
import type { ConversationWorkingMemory } from '../../domain/memory/memory.types.js'
import type { IEventLogRepository } from '../ports/IEventLogRepository.js'
import type { ILlmAdapter } from '../ports/ILlmAdapter.js'
import type { IMessageRepository } from '../ports/IMessageRepository.js'
import type { IMemoryMaintenancePort } from '../ports/IMemoryMaintenancePort.js'
import type { IConversationWorkingMemoryRepository } from '../ports/IConversationWorkingMemoryRepository.js'
import type { IModelConfigRepository } from '../ports/IModelConfigRepository.js'
import type { ModelConfig } from '../../domain/model-config/index.js'
import type { LlmAdapterRegistry } from '../../infrastructure/llm/llm-adapter-registry.js'
import { logResolvedLlmCall, resolveRoleLlmCall } from './model-resolution-runtime.service.js'

const WORKING_MEMORY_COMPACTION_SYSTEM_PROMPT = `You update a running working memory for a conversation.

You will receive:
- PRIOR MEMORY: the existing compacted memory from earlier exchanges (may be empty on first run).
- RECENT EXCHANGES: the most recent messages that have not yet been integrated.

Rules:
- Return JSON only, with shape { summary, unresolvedThreads, candidateFacts }.
- summary must integrate prior memory with new information, bounded to ~700 chars. Never drop key facts from prior memory unless superseded.
- unresolvedThreads: 0-6 concise unresolved user threads (carry forward unresolved ones from prior memory).
- candidateFacts: 0-8 objects with { category, key, value } (merge and deduplicate with prior facts, update values if superseded).
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
const WORKING_MEMORY_RECENT_MESSAGE_LIMIT = 10

export class MemoryMaintenanceService implements IMemoryMaintenancePort {
  constructor(
    private readonly messageRepository: IMessageRepository,
    private readonly conversationWorkingMemoryRepository: IConversationWorkingMemoryRepository,
    private readonly eventLogRepository: IEventLogRepository,
    private readonly llm: ILlmAdapter,
    private readonly modelConfigRepository?: IModelConfigRepository,
    private readonly llmAdapterRegistry?: LlmAdapterRegistry,
    private readonly modelConfigFallback?: ModelConfig,
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
      const messages = await this.messageRepository.findByConversationId(input.conversationId)
      const priorMemory: ConversationWorkingMemory | null =
        await this.conversationWorkingMemoryRepository.findByConversationId(input.conversationId)
      const ordered = messages
        .slice()
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      const exchangeCount = countExchanges(ordered)
      if (input.trigger === 'post_turn' && exchangeCount % 3 !== 0) {
        return
      }
      const recentOrdered = ordered.slice(-WORKING_MEMORY_RECENT_MESSAGE_LIMIT)

      const rewritten = await this.rewriteWorkingMemory(recentOrdered, priorMemory, {
        requestId,
        sessionId: input.sessionId,
        conversationId: input.conversationId,
        avatarId: input.avatarId,
        trigger: input.trigger,
      })

      await this.conversationWorkingMemoryRepository.upsert({
        conversationId: input.conversationId,
        sessionId: input.sessionId,
        avatarId: input.avatarId,
        summary: rewritten.summary,
        unresolvedThreads: rewritten.unresolvedThreads,
        candidateFacts: rewritten.candidateFacts,
      })

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
          workingSummary: rewritten.summary,
          messageCount: recentOrdered.length,
          unresolvedThreads: rewritten.unresolvedThreads,
          candidateFacts: rewritten.candidateFacts,
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
    priorMemory: {
      summary: string
      unresolvedThreads: string[]
      candidateFacts: Array<{ category: string; key: string; value: string }>
    } | null,
    context: {
      requestId: string
      sessionId: string
      conversationId: string
      avatarId: string
      trigger: 'post_turn' | 'conversation_closed' | 'avatar_switch' | 'admin_trigger'
    },
  ) {
    const resolvedLlm = await this.resolveMemoryLlmCall()
    const llmRequest = {
      systemPrompt: WORKING_MEMORY_COMPACTION_SYSTEM_PROMPT,
      messages: [{ role: 'user' as const, content: buildCompactionInput(messages, priorMemory) }],
      ...(resolvedLlm.model !== undefined ? { model: resolvedLlm.model } : {}),
      maxTokens: 500,
      trace: {
        requestId: context.requestId,
        sessionId: context.sessionId,
        event: 'memory.maintenance.compaction',
        errorEvent: 'memory.maintenance.llm_error',
        metadata: {
          conversationId: context.conversationId,
          avatarId: context.avatarId,
          trigger: context.trigger,
          effectiveProvider: resolvedLlm.provider,
          effectiveModel: resolvedLlm.effectiveModel,
        },
      },
    }
    logResolvedLlmCall({
      role: 'memory',
      effectiveProvider: resolvedLlm.provider,
      effectiveModel: resolvedLlm.effectiveModel,
    })
    const response = await resolvedLlm.adapter.complete(llmRequest)

    const parsed = parseCompactionOutput(response.content)

    if (parsed !== null) return parsed
    throw new Error('[memory-maintenance] LLM returned unparseable compaction output')
  }

  private async resolveMemoryLlmCall(): Promise<{
    adapter: ILlmAdapter
    provider: string
    model?: string
    effectiveModel: string
  }> {
    return await resolveRoleLlmCall({
      role: 'memory',
      legacyAdapter: this.llm,
      modelConfigRepository: this.modelConfigRepository,
      llmAdapterRegistry: this.llmAdapterRegistry,
      modelConfigFallback: this.modelConfigFallback,
      avatarOverride: undefined,
    })
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

function buildCompactionInput(
  messages: Array<{ role: 'user' | 'avatar' | 'system'; createdAt: string; content: string }>,
  priorMemory: {
    summary: string
    unresolvedThreads: string[]
    candidateFacts: Array<{ category: string; key: string; value: string }>
  } | null,
): string {
  const parts: string[] = []

  if (priorMemory !== null) {
    parts.push('--- PRIOR MEMORY ---')
    parts.push(`Summary: ${priorMemory.summary}`)
    if (priorMemory.unresolvedThreads.length > 0) {
      parts.push(`Unresolved threads: ${priorMemory.unresolvedThreads.join('; ')}`)
    }
    if (priorMemory.candidateFacts.length > 0) {
      const facts = priorMemory.candidateFacts
        .map((f) => `  [${f.category}] ${f.key}: ${f.value}`)
        .join('\n')
      parts.push(`Known facts:\n${facts}`)
    }
    parts.push('')
  }

  parts.push('--- RECENT EXCHANGES ---')
  parts.push(messages.map((m) => `${m.role}: ${m.content.trim()}`).join('\n'))

  return parts.join('\n')
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

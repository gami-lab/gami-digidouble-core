import crypto from 'node:crypto'
import type {
  ConversationWorkingMemory,
  ConversationWorkingMemoryRefreshOutput,
  MemoryFactRecord,
  VerifiedMemoryContext,
} from '../../domain/memory/memory.types.js'
import type { IEventLogRepository } from '../ports/IEventLogRepository.js'
import type { ILlmAdapter } from '../ports/ILlmAdapter.js'
import type { IMessageRepository } from '../ports/IMessageRepository.js'
import type { IMemoryMaintenancePort } from '../ports/IMemoryMaintenancePort.js'
import type { IConversationWorkingMemoryRepository } from '../ports/IConversationWorkingMemoryRepository.js'
import type { IModelConfigRepository } from '../ports/IModelConfigRepository.js'
import type { IScenarioRepository } from '../ports/IScenarioRepository.js'
import type { ISessionRepository } from '../ports/ISessionRepository.js'
import type { ModelConfig } from '../../domain/model-config/index.js'
import type { LlmAdapterRegistry } from '../../infrastructure/llm/llm-adapter-registry.js'
import { isUnsupportedContradictedAvatarClaim } from './memory-contradiction.policy.js'
import { logResolvedLlmCall, resolveRoleLlmCall } from './model-resolution-runtime.service.js'

const WORKING_MEMORY_COMPACTION_SYSTEM_PROMPT = `You update a running working memory for a conversation.

You will receive:
- PRIOR WORKING MEMORY: the existing compacted memory from earlier exchanges (may be empty on first run).
- RECENT EXCHANGES TO INTEGRATE: the most recent exchanges that have not yet been integrated.

Rules:
- Return JSON only with exactly these top-level keys: summary, coveredTopics, unresolvedThreads, candidateFacts.
- summary:
  - merge prior memory with the newly integrated exchanges
  - remove repetition and stale wording
  - keep the most current version when details were corrected or superseded
  - stay concise, factual, and bounded to ~700 chars
- coveredTopics:
  - 0-8 short factual topic labels for subjects already explored
  - list covered subjects, not unresolved next steps
  - keep items normalized, non-duplicative, and grounded in the conversation
- unresolvedThreads:
  - 0-6 active loose ends that still need follow-up
  - carry forward only threads that remain unresolved
  - remove items that were clearly answered or resolved in the recent exchanges
- candidateFacts:
  - 0-8 objective persistent facts grounded in the discussion
  - use only { category, key, value }
  - merge with prior facts, deduplicate exact duplicates, and replace superseded values when warranted
  - reject inferred trust, mood, pacing, progression state, emotional state, or other conversational interpretation
- category must be one of: conversation_signal, preference, constraint, goal, identity, context.
- key must be compact lowercase snake_case.
- value must be concise, factual, and grounded in the conversation.
- Treat Avatar statements as conversational claims, not automatically as canonical facts.
- Do not persist an Avatar claim as a candidateFact when the user challenges it, when another recent message contradicts it, or when the conversation does not independently verify it.
- When the user identifies a contradiction and no verified resolution is supplied, preserve the issue as an unresolvedThread.
- A later Avatar correction may replace earlier wording in the conversation summary, but it must not automatically become a persistent objective fact.
- Persist a candidateFact only when it is supported by an explicit user statement, verified canonical context supplied to the compactor, an application-provided confirmed fact, or an unchallenged stable conversational fact that is safe to retain.
- When factual status remains uncertain, preserve the uncertainty instead of selecting the most recent claim as truth.
- Do not convert model-generated explanations for errors into character facts. For example, "my memories are confused" must not become a persistent character condition unless the scenario explicitly establishes it.
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
const REJECTED_FACT_KEYS = new Set([
  'trust_level',
  'user_trust',
  'avatar_trust',
  'mood',
  'sentiment',
  'emotional_state',
  'rapport_state',
  'engagement_level',
  'conversation_pacing',
  'pacing',
  'progression_state',
  'progression',
])
const REJECTED_MODEL_ERROR_EXPLANATIONS = [
  /my memories are confused/i,
  /my memory is confused/i,
  /my memories are unreliable/i,
]
const WORKING_MEMORY_RECENT_MESSAGE_LIMIT = 10
const WORKING_MEMORY_SUMMARY_MAX_LENGTH = 700
const WORKING_MEMORY_THREAD_LIMIT = 6
const WORKING_MEMORY_THREAD_MAX_LENGTH = 160
const WORKING_MEMORY_COVERED_TOPIC_LIMIT = 8
const WORKING_MEMORY_COVERED_TOPIC_MAX_LENGTH = 80
const WORKING_MEMORY_FACT_LIMIT = 8
const WORKING_MEMORY_FACT_KEY_MAX_LENGTH = 48
const WORKING_MEMORY_FACT_VALUE_MAX_LENGTH = 160
const WORKING_MEMORY_COMPACTION_MAX_TOKENS = 1000

type MemoryCompactionResult = {
  memory: ConversationWorkingMemoryRefreshOutput
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
}

export class MemoryMaintenanceService implements IMemoryMaintenancePort {
  private readonly pendingRefreshes = new Map<string, Promise<void>>()

  constructor(
    private readonly messageRepository: IMessageRepository,
    private readonly conversationWorkingMemoryRepository: IConversationWorkingMemoryRepository,
    private readonly eventLogRepository: IEventLogRepository,
    private readonly llm: ILlmAdapter,
    private readonly modelConfigRepository?: IModelConfigRepository,
    private readonly llmAdapterRegistry?: LlmAdapterRegistry,
    private readonly modelConfigFallback?: ModelConfig,
    private readonly scenarioRepository?: IScenarioRepository,
    private readonly sessionRepository?: ISessionRepository,
  ) {}

  async awaitPendingRefresh(conversationId: string): Promise<void> {
    const pending = this.pendingRefreshes.get(conversationId)
    if (pending !== undefined) {
      await pending
    }
  }

  async execute(input: {
    sessionId: string
    conversationId: string
    avatarId: string
    scenarioId: string
    trigger: 'post_turn' | 'conversation_closed' | 'avatar_switch' | 'admin_trigger'
    correlationId?: string
    verifiedContext?: VerifiedMemoryContext[]
  }): Promise<void> {
    const prior = this.pendingRefreshes.get(input.conversationId) ?? Promise.resolve()
    const tracked = prior
      .catch(() => undefined)
      .then(() => this.executeRefresh(input))
      .finally(() => {
        if (this.pendingRefreshes.get(input.conversationId) === tracked) {
          this.pendingRefreshes.delete(input.conversationId)
        }
      })

    this.pendingRefreshes.set(input.conversationId, tracked)
    await tracked
  }

  private async executeRefresh(input: {
    sessionId: string
    conversationId: string
    avatarId: string
    scenarioId: string
    trigger: 'post_turn' | 'conversation_closed' | 'avatar_switch' | 'admin_trigger'
    correlationId?: string
    verifiedContext?: VerifiedMemoryContext[]
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
        scenarioId: input.scenarioId,
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
        scenarioId: input.scenarioId,
        trigger: input.trigger,
        ...(input.verifiedContext !== undefined ? { verifiedContext: input.verifiedContext } : {}),
      })

      await this.conversationWorkingMemoryRepository.upsert({
        conversationId: input.conversationId,
        sessionId: input.sessionId,
        avatarId: input.avatarId,
        summary: rewritten.memory.summary,
        unresolvedThreads: rewritten.memory.unresolvedThreads,
        coveredTopics: rewritten.memory.coveredTopics,
        candidateFacts: rewritten.memory.candidateFacts,
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
          scenarioId: input.scenarioId,
          trigger: input.trigger,
          workingSummary: rewritten.memory.summary,
          messageCount: recentOrdered.length,
          unresolvedThreads: rewritten.memory.unresolvedThreads,
          coveredTopics: rewritten.memory.coveredTopics,
          candidateFacts: rewritten.memory.candidateFacts,
          exchangeCount,
          provider: rewritten.provider,
          model: rewritten.model,
          inputTokens: rewritten.inputTokens,
          outputTokens: rewritten.outputTokens,
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
          scenarioId: input.scenarioId,
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
    priorMemory: ConversationWorkingMemoryRefreshOutput | null,
    context: {
      requestId: string
      sessionId: string
      conversationId: string
      avatarId: string
      scenarioId: string
      trigger: 'post_turn' | 'conversation_closed' | 'avatar_switch' | 'admin_trigger'
      verifiedContext?: VerifiedMemoryContext[]
    },
  ): Promise<MemoryCompactionResult> {
    const resolvedLlm = await this.resolveMemoryLlmCall(context.scenarioId, context.sessionId)
    const llmRequest = {
      systemPrompt: WORKING_MEMORY_COMPACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user' as const,
          content: buildCompactionInput(messages, priorMemory, context.verifiedContext),
        },
      ],
      ...(resolvedLlm.model !== undefined ? { model: resolvedLlm.model } : {}),
      maxTokens: WORKING_MEMORY_COMPACTION_MAX_TOKENS,
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

    const parsed = parseCompactionOutput(
      response.content,
      priorMemory,
      messages,
      context.verifiedContext,
    )

    if (parsed !== null) {
      return {
        memory: parsed,
        provider: resolvedLlm.provider,
        model: response.model,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      }
    }
    throw new Error('[memory-maintenance] LLM returned unparseable compaction output')
  }

  private async resolveMemoryLlmCall(
    scenarioId: string,
    sessionId: string,
  ): Promise<{
    adapter: ILlmAdapter
    provider: string
    model?: string
    effectiveModel: string
  }> {
    const scenario = await this.scenarioRepository?.findById(scenarioId)
    const session = await this.sessionRepository?.findById(sessionId)
    return await resolveRoleLlmCall({
      role: 'memory',
      legacyAdapter: this.llm,
      modelConfigRepository: this.modelConfigRepository,
      llmAdapterRegistry: this.llmAdapterRegistry,
      modelConfigFallback: this.modelConfigFallback,
      avatarOverride: undefined,
      ...(session?.modelOverride !== undefined ? { sessionOverride: session.modelOverride } : {}),
      scenarioModelSelection: scenario?.modelSelection,
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
  priorMemory: ConversationWorkingMemoryRefreshOutput | null,
  verifiedContext: VerifiedMemoryContext[] | undefined,
): string {
  const parts: string[] = []

  if (priorMemory !== null) {
    parts.push('## PRIOR WORKING MEMORY')
    parts.push(`Summary: ${priorMemory.summary}`)
    parts.push(...renderPromptList('Covered topics', priorMemory.coveredTopics))
    parts.push(...renderPromptList('Unresolved threads', priorMemory.unresolvedThreads))
    parts.push(...renderPromptFacts(priorMemory.candidateFacts))
    parts.push('')
  }

  if (verifiedContext !== undefined && verifiedContext.length > 0) {
    parts.push('## VERIFIED CONTEXT')
    parts.push(
      ...verifiedContext.map(
        (entry) => `- [${entry.source}] ${entry.content.replace(/\s+/g, ' ').trim()}`,
      ),
    )
    parts.push(
      'Use this labeled context to resolve contradictions; do not infer authority from raw conversation alone.',
    )
    parts.push('')
  }

  parts.push('## RECENT EXCHANGES TO INTEGRATE')
  parts.push(...renderPromptMessages(messages))

  return parts.join('\n')
}

function parseCompactionOutput(
  content: string,
  priorMemory: ConversationWorkingMemoryRefreshOutput | null,
  messages: Array<{ role: 'user' | 'avatar' | 'system'; createdAt: string; content: string }>,
  verifiedContext: VerifiedMemoryContext[] | undefined,
): ConversationWorkingMemoryRefreshOutput | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(stripMarkdownFences(content))
  } catch {
    return null
  }
  if (!isRecord(parsed)) return null

  const summary = readNormalizedString(parsed['summary'], WORKING_MEMORY_SUMMARY_MAX_LENGTH)
  if (summary === null) return null

  const unresolvedThreads = readStringArray(parsed['unresolvedThreads'], {
    maxItems: WORKING_MEMORY_THREAD_LIMIT,
    maxLength: WORKING_MEMORY_THREAD_MAX_LENGTH,
  })
  const coveredTopics = Object.hasOwn(parsed, 'coveredTopics')
    ? readStringArray(parsed['coveredTopics'], {
        maxItems: WORKING_MEMORY_COVERED_TOPIC_LIMIT,
        maxLength: WORKING_MEMORY_COVERED_TOPIC_MAX_LENGTH,
      })
    : (priorMemory?.coveredTopics ?? [])
  const candidateFacts = readCandidateFacts(parsed['candidateFacts'], messages, verifiedContext)

  return {
    summary,
    unresolvedThreads,
    coveredTopics,
    candidateFacts,
  }
}

function readCandidateFacts(
  value: unknown,
  messages: Array<{ role: 'user' | 'avatar' | 'system'; createdAt: string; content: string }>,
  verifiedContext: VerifiedMemoryContext[] | undefined,
): MemoryFactRecord[] {
  if (!Array.isArray(value)) return []

  const facts: MemoryFactRecord[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const fact = toCandidateFact(item)
    if (fact === null) continue
    if (isUnsupportedContradictedAvatarClaim(fact, messages, verifiedContext)) continue
    const dedupeKey = `${fact.category}::${fact.key}::${fact.value}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    facts.push(fact)
    if (facts.length >= WORKING_MEMORY_FACT_LIMIT) break
  }
  return facts
}

function toCandidateFact(value: unknown): MemoryFactRecord | null {
  if (!isRecord(value)) return null
  const category = readNormalizedString(value['category'], 32)
  const key = readFactKey(value['key'])
  const factValue = readNormalizedString(value['value'], WORKING_MEMORY_FACT_VALUE_MAX_LENGTH)
  if (category === null || key === null || factValue === null) return null
  if (!ALLOWED_FACT_CATEGORIES.has(category)) return null
  if (REJECTED_FACT_KEYS.has(key)) return null
  if (REJECTED_MODEL_ERROR_EXPLANATIONS.some((pattern) => pattern.test(factValue))) return null
  return { category, key, value: factValue }
}

function readStringArray(
  value: unknown,
  options: { maxItems: number; maxLength: number },
): string[] {
  if (!Array.isArray(value)) return []
  const items: string[] = []
  const seen = new Set<string>()

  for (const entry of value) {
    const normalized = readNormalizedString(entry, options.maxLength)
    if (normalized === null || seen.has(normalized)) continue
    seen.add(normalized)
    items.push(normalized)
    if (items.length >= options.maxItems) break
  }

  return items
}

function readFactKey(value: unknown): string | null {
  const normalized = readNormalizedString(value, WORKING_MEMORY_FACT_KEY_MAX_LENGTH)
  if (normalized === null) return null
  return /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(normalized) ? normalized : null
}

function readNormalizedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const compacted = value.replace(/\s+/g, ' ').trim()
  if (compacted.length === 0) return null
  return truncateText(compacted, maxLength)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  if (maxLength <= 3) return value.slice(0, maxLength)
  return `${value.slice(0, maxLength - 3)}...`
}

function renderPromptList(label: string, items: string[]): string[] {
  if (items.length === 0) {
    return [`${label}: none`]
  }
  return [label + ':', ...items.map((item) => `- ${item}`)]
}

function renderPromptFacts(facts: MemoryFactRecord[]): string[] {
  if (facts.length === 0) {
    return ['Candidate facts: none']
  }
  return [
    'Candidate facts:',
    ...facts.map((fact) => `- [${fact.category}] ${fact.key}: ${fact.value}`),
  ]
}

function renderPromptMessages(
  messages: Array<{ role: 'user' | 'avatar' | 'system'; createdAt: string; content: string }>,
): string[] {
  if (messages.length === 0) {
    return ['[none]']
  }
  return messages.map(
    (message, index) =>
      `${String(index + 1)}. ${message.role.toUpperCase()}: ${message.content.replace(/\s+/g, ' ').trim()}`,
  )
}

function stripMarkdownFences(content: string): string {
  const trimmed = content.trim()
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed)
  return match?.[1]?.trim() ?? trimmed
}

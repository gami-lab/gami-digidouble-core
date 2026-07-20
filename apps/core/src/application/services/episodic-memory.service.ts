import type { IConversationMemoryRepository } from '../ports/IConversationMemoryRepository.js'
import type { IConversationWorkingMemoryRepository } from '../ports/IConversationWorkingMemoryRepository.js'
import type { IMessageRepository } from '../ports/IMessageRepository.js'
import type {
  ConversationMemory,
  ConversationWorkingMemorySnapshot,
  ConversationWorkingMemoryRefreshOutput,
} from '../../domain/memory/memory.types.js'
import {
  buildHydrationSummary,
  selectRelevantConversationMemories,
} from '../../domain/memory/episodic-memory.policy.js'
import {
  MEMORY_EPISODIC_RETRIEVAL_LIMIT,
  MEMORY_EPISODIC_SELECTION_LIMIT,
} from '../../domain/memory/memory.policy.js'

export class EpisodicMemoryService {
  constructor(
    private readonly conversationMemoryRepository: IConversationMemoryRepository,
    private readonly conversationWorkingMemoryRepository: IConversationWorkingMemoryRepository,
    private readonly messageRepository: IMessageRepository,
  ) {}

  async generateForClosedConversation(input: {
    conversationId: string
    sessionId: string
    userId: string
    avatarId: string
    scenarioId: string
  }): Promise<ConversationMemory> {
    const existing = await this.conversationMemoryRepository.findByConversationId(
      input.conversationId,
    )
    if (existing !== null) return existing

    const conversationWorkingMemory =
      await this.conversationWorkingMemoryRepository.findByConversationId(input.conversationId)
    const fallback = await this.buildFallbackWorkingMemory(input.conversationId)
    const source = conversationWorkingMemory ?? fallback

    return this.conversationMemoryRepository.create({
      conversationId: input.conversationId,
      sessionId: input.sessionId,
      userId: input.userId,
      avatarId: input.avatarId,
      scenarioId: input.scenarioId,
      summary: source.summary,
      keyDiscoveries: source.unresolvedThreads.slice(0, 5),
      unresolvedTopics: source.unresolvedThreads,
      factCandidates: source.candidateFacts,
    })
  }

  async hydrateForNewConversationWithMetadata(input: {
    conversationId: string
    sessionId: string
    userId: string
    avatarId: string
    scenarioId: string
    queryText?: string
  }): Promise<{
    hydration: ConversationWorkingMemoryRefreshOutput
    selectedConversationIds: string[]
    consideredConversationIds: string[]
  }> {
    const scoped = await this.conversationMemoryRepository.listByScope({
      userId: input.userId,
      avatarId: input.avatarId,
      scenarioId: input.scenarioId,
      limit: MEMORY_EPISODIC_RETRIEVAL_LIMIT,
    })

    const selected = selectRelevantConversationMemories(
      scoped,
      input.queryText ?? '',
      MEMORY_EPISODIC_SELECTION_LIMIT,
    )
    const summary = buildHydrationSummary(selected)
    const unresolvedThreads = unique(
      selected.flatMap((memory) => memory.unresolvedTopics).slice(0, 6),
    )
    const factCandidates = uniqueFacts(selected.flatMap((memory) => memory.factCandidates)).slice(
      0,
      8,
    )

    return {
      hydration: { summary, unresolvedThreads, coveredTopics: [], candidateFacts: factCandidates },
      selectedConversationIds: selected.map((memory) => memory.conversationId),
      consideredConversationIds: scoped.map((memory) => memory.conversationId),
    }
  }

  private async buildFallbackWorkingMemory(
    conversationId: string,
  ): Promise<ConversationWorkingMemoryRefreshOutput> {
    const messages = await this.messageRepository.findByConversationId(conversationId, {
      limit: 20,
    })
    const ordered = messages
      .slice()
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    const summary =
      ordered.length === 0
        ? 'No exchanged messages yet.'
        : `Conversation closed with ${String(ordered.length)} messages.`
    const unresolvedThreads = ordered
      .filter((message) => message.role === 'user')
      .slice(-3)
      .map((message) => message.content.trim())
      .filter((text) => text.length > 0)
    const candidateFacts = unresolvedThreads.map((value, index) => ({
      category: 'conversation_signal',
      key: `thread_${String(index + 1)}`,
      value,
    }))
    return { summary, unresolvedThreads, coveredTopics: [], candidateFacts }
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function uniqueFacts(
  facts: ConversationWorkingMemorySnapshot['candidateFacts'],
): ConversationWorkingMemorySnapshot['candidateFacts'] {
  const seen = new Set<string>()
  const deduped: Array<{ category: string; key: string; value: string }> = []
  for (const fact of facts) {
    const key = `${fact.category}::${fact.key}::${fact.value}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(fact)
  }
  return deduped
}

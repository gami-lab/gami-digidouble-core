import type { ConversationWorkingMemoryRefreshOutput } from './memory.types.js'
import type { WorkingMemorySummaryMessage } from './working-memory-summary.policy.js'
import { buildSessionWorkingMemorySummary } from './working-memory-summary.policy.js'

type PriorMemory = Pick<
  ConversationWorkingMemoryRefreshOutput,
  'summary' | 'unresolvedThreads' | 'coveredTopics' | 'candidateFacts'
>

export function rewriteConversationWorkingMemory(
  messages: WorkingMemorySummaryMessage[],
  priorMemory: PriorMemory | null = null,
): ConversationWorkingMemoryRefreshOutput {
  const ordered = messages.slice().sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
  const recentSummary = buildSessionWorkingMemorySummary(ordered)
  const summary =
    priorMemory !== null && priorMemory.summary.length > 0
      ? `${priorMemory.summary} | ${recentSummary}`
      : recentSummary

  const recentUnresolved = collectUnresolvedThreads(ordered)
  const unresolvedThreads =
    priorMemory !== null
      ? deduplicate([...priorMemory.unresolvedThreads, ...recentUnresolved]).slice(0, 6)
      : recentUnresolved

  const recentFacts = collectCandidateFacts(ordered)
  const candidateFacts =
    priorMemory !== null
      ? mergeCandidateFacts(priorMemory.candidateFacts, recentFacts).slice(0, 8)
      : recentFacts

  return {
    summary: summary.length > 700 ? `${summary.slice(0, 700)}...` : summary,
    unresolvedThreads,
    coveredTopics: priorMemory?.coveredTopics ?? [],
    candidateFacts,
  }
}

function collectUnresolvedThreads(messages: WorkingMemorySummaryMessage[]): string[] {
  const recentUsers = messages
    .filter((message) => message.role === 'user')
    .slice(-3)
    .map((message) => message.content.trim())
    .filter((content) => content.length > 0)

  return recentUsers.map((content) => compact(content))
}

function collectCandidateFacts(messages: WorkingMemorySummaryMessage[]): Array<{
  category: string
  key: string
  value: string
}> {
  const recentUsers = messages
    .filter((message) => message.role === 'user')
    .slice(-5)
    .map((message) => message.content.trim())
    .filter((content) => content.length > 0)

  return recentUsers.map((content, index) => ({
    category: 'conversation_signal',
    key: `thread_${String(index + 1)}`,
    value: compact(content),
  }))
}

function compact(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length <= 160 ? normalized : `${normalized.slice(0, 160)}...`
}

function deduplicate(items: string[]): string[] {
  return [...new Set(items)]
}

function mergeCandidateFacts(
  prior: Array<{ category: string; key: string; value: string }>,
  recent: Array<{ category: string; key: string; value: string }>,
): Array<{ category: string; key: string; value: string }> {
  const map = new Map<string, { category: string; key: string; value: string }>()
  for (const fact of prior) {
    map.set(fact.key, fact)
  }
  for (const fact of recent) {
    map.set(fact.key, fact)
  }
  return [...map.values()]
}

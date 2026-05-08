import type { ConversationWorkingMemoryRefreshOutput } from './memory.types.js'
import type { WorkingMemorySummaryMessage } from './working-memory-summary.policy.js'
import { buildSessionWorkingMemorySummary } from './working-memory-summary.policy.js'

export function rewriteConversationWorkingMemory(
  messages: WorkingMemorySummaryMessage[],
): ConversationWorkingMemoryRefreshOutput {
  const ordered = messages.slice().sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
  return {
    summary: buildSessionWorkingMemorySummary(ordered),
    unresolvedThreads: collectUnresolvedThreads(ordered),
    candidateFacts: collectCandidateFacts(ordered),
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

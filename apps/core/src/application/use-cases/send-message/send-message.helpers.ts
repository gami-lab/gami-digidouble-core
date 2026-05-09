import type { SelectedMemoryPayload } from '../../../domain/memory/memory.types.js'
import type { Message } from '../../../domain/conversation/session.types.js'

export function toRecentExchanges(
  history: Message[],
  exchangeLimit: number,
): Array<{ user: string; avatar: string }> {
  const exchanges: Array<{ user: string; avatar: string }> = []
  let pendingUser: string | undefined

  for (const message of history) {
    if (message.role === 'user') {
      pendingUser = message.content
      continue
    }
    if (message.role === 'avatar' && pendingUser !== undefined) {
      exchanges.push({ user: pendingUser, avatar: message.content })
      pendingUser = undefined
    }
  }

  return exchanges.slice(-exchangeLimit)
}

export function toLlmDialogueMessages(
  exchanges: Array<{ user: string; avatar: string }>,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return exchanges.flatMap((exchange) => [
    { role: 'user' as const, content: exchange.user },
    { role: 'assistant' as const, content: exchange.avatar },
  ])
}

export function hasText(value: string): boolean {
  return value.trim().length > 0
}

export function hasSelectedMemoryContent(selected: SelectedMemoryPayload): boolean {
  return (
    selected.shortTermExchanges.length > 0 ||
    selected.workingMemory !== undefined ||
    selected.episodicMemories.length > 0 ||
    selected.longTermFacts.length > 0
  )
}

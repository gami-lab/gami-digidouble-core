import type { ShortTermMemoryExchange } from '../../domain/memory/memory.types.js'

type ConversationMessage = {
  role: 'user' | 'avatar' | 'system'
  content: string
  createdAt: string
}

type CompletedExchange = {
  user: string
  userCreatedAt: string
  avatar: string
  avatarCreatedAt: string
}

export function selectExchangeWindow(
  messages: ConversationMessage[],
  workingMemoryUpdatedAt?: string,
  fallbackExchangeCount = 1,
): ShortTermMemoryExchange[] {
  const selected = selectCompletedExchanges(messages, workingMemoryUpdatedAt, fallbackExchangeCount)
  return selected.map((exchange) => ({
    user: exchange.user,
    avatar: exchange.avatar,
  }))
}

export function selectExchangeMessageWindow(
  messages: ConversationMessage[],
  workingMemoryUpdatedAt?: string,
  fallbackExchangeCount = 1,
): Array<{ role: 'user' | 'avatar'; content: string }> {
  const selected = selectCompletedExchanges(messages, workingMemoryUpdatedAt, fallbackExchangeCount)
  return selected.flatMap((exchange) => [
    { role: 'user' as const, content: exchange.user },
    { role: 'avatar' as const, content: exchange.avatar },
  ])
}

function selectCompletedExchanges(
  messages: ConversationMessage[],
  workingMemoryUpdatedAt?: string,
  fallbackExchangeCount = 1,
): CompletedExchange[] {
  const exchanges = toCompletedExchanges(messages)
  if (exchanges.length === 0) return []
  if (workingMemoryUpdatedAt === undefined) return exchanges

  const thresholdMs = Date.parse(workingMemoryUpdatedAt)
  const uncovered = exchanges.filter(
    (exchange) => Date.parse(exchange.avatarCreatedAt) > thresholdMs,
  )
  if (uncovered.length > 0) return uncovered

  return fallbackExchangeCount > 0 ? exchanges.slice(-fallbackExchangeCount) : []
}

function toCompletedExchanges(messages: ConversationMessage[]): CompletedExchange[] {
  const ordered = messages.slice().sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
  const exchanges: CompletedExchange[] = []
  let pendingUser: ConversationMessage | undefined

  for (const message of ordered) {
    if (message.role === 'user') {
      pendingUser = message
      continue
    }
    if (message.role === 'avatar' && pendingUser !== undefined) {
      exchanges.push({
        user: pendingUser.content,
        userCreatedAt: pendingUser.createdAt,
        avatar: message.content,
        avatarCreatedAt: message.createdAt,
      })
      pendingUser = undefined
    }
  }

  return exchanges
}

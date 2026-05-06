import {
  WORKING_MEMORY_AVATAR_RECENT_MESSAGE_LIMIT,
  WORKING_MEMORY_SESSION_RECENT_MESSAGE_LIMIT,
  WORKING_MEMORY_SNIPPET_MAX_LENGTH,
} from './memory.policy.js'

export type WorkingMemorySummaryMessage = {
  role: string
  content: string
}

export function buildSessionWorkingMemorySummary(messages: WorkingMemorySummaryMessage[]): string {
  if (messages.length === 0) {
    return 'No exchanged messages yet.'
  }

  const userCount = messages.filter((message) => message.role === 'user').length
  const avatarCount = messages.filter((message) => message.role === 'avatar').length
  const snippets = messages
    .filter((message) => message.role === 'user' || message.role === 'avatar')
    .slice(-WORKING_MEMORY_SESSION_RECENT_MESSAGE_LIMIT)
    .map((message) => `${message.role}: ${compactText(message.content)}`)
    .join(' | ')

  return `Conversation turns: user=${String(userCount)}, avatar=${String(avatarCount)}. Recent context: ${snippets}`
}

export function buildAvatarWorkingMemorySummary(
  messages: WorkingMemorySummaryMessage[],
  avatarId: string,
): string {
  const snippets = messages
    .filter((message) => message.role === 'user' || message.role === 'avatar')
    .slice(-WORKING_MEMORY_AVATAR_RECENT_MESSAGE_LIMIT)
    .map((message) => `${message.role}: ${compactText(message.content)}`)
    .join(' | ')

  return `Avatar ${avatarId} recent dialogue context: ${snippets.length > 0 ? snippets : 'none'}.`
}

function compactText(content: string): string {
  const normalized = content.trim().replace(/\s+/g, ' ')
  if (normalized.length <= WORKING_MEMORY_SNIPPET_MAX_LENGTH) return normalized
  return `${normalized.slice(0, WORKING_MEMORY_SNIPPET_MAX_LENGTH)}...`
}

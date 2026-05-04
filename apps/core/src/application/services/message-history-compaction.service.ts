import type { IConversationCompactionPort } from '../ports/IConversationCompactionPort.js'
import type { IMessageRepository } from '../ports/IMessageRepository.js'

const MAX_SNIPPET_LENGTH = 220

export class MessageHistoryCompactionService implements IConversationCompactionPort {
  constructor(private readonly messageRepository: IMessageRepository) {}

  async compactConversation(input: {
    sessionId: string
    conversationId: string
  }): Promise<{ summary: string }> {
    const messages = await this.messageRepository.findByConversationId(input.conversationId)
    const ordered = messages
      .slice()
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    if (ordered.length === 0) {
      return { summary: 'Conversation ended with no exchanged messages.' }
    }

    const userCount = ordered.filter((message) => message.role === 'user').length
    const avatarCount = ordered.filter((message) => message.role === 'avatar').length
    const keySnippets = ordered
      .filter((message) => message.role === 'user' || message.role === 'avatar')
      .slice(-6)
      .map((message) => `${message.role}: ${compactText(message.content)}`)
      .join(' | ')

    return {
      summary: `Conversation turns: user=${String(userCount)}, avatar=${String(avatarCount)}. Recent context: ${keySnippets}`,
    }
  }
}

function compactText(content: string): string {
  const normalized = content.trim().replace(/\s+/g, ' ')
  if (normalized.length <= MAX_SNIPPET_LENGTH) return normalized
  return `${normalized.slice(0, MAX_SNIPPET_LENGTH)}...`
}

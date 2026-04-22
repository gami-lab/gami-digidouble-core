import type {
  IMessageRepository,
  FindMessagesOptions,
  SaveMessageParams,
} from '../../application/ports/IMessageRepository.js'
import type { Message } from '../../domain/conversation/session.types.js'

/**
 * In-memory message repository for tests and local deterministic flows.
 */
export class InMemoryMessageRepository implements IMessageRepository {
  private readonly messages: Message[]

  constructor(initialData: Message[] = []) {
    this.messages = [...initialData]
  }

  findByConversationId(conversationId: string, options?: FindMessagesOptions): Promise<Message[]> {
    const bySession = this.messages
      .filter((message) => message.conversationId === conversationId)
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))

    if (options?.limit === undefined) return Promise.resolve(bySession)
    return Promise.resolve(bySession.slice(-options.limit))
  }

  save(params: SaveMessageParams): Promise<Message> {
    const message: Message = { ...params }
    this.messages.push(message)
    return Promise.resolve(message)
  }

  deleteByConversationId(conversationId: string): Promise<number> {
    const matchingIndexes: number[] = []
    for (let index = 0; index < this.messages.length; index += 1) {
      if (this.messages[index]?.conversationId === conversationId) {
        matchingIndexes.push(index)
      }
    }

    for (let index = matchingIndexes.length - 1; index >= 0; index -= 1) {
      const messageIndex = matchingIndexes[index]
      if (messageIndex !== undefined) {
        this.messages.splice(messageIndex, 1)
      }
    }

    return Promise.resolve(matchingIndexes.length)
  }
}

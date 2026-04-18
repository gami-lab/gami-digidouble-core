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

  findBySessionId(sessionId: string, options?: FindMessagesOptions): Promise<Message[]> {
    const bySession = this.messages
      .filter((message) => message.sessionId === sessionId)
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))

    if (options?.limit === undefined) return Promise.resolve(bySession)
    return Promise.resolve(bySession.slice(-options.limit))
  }

  save(params: SaveMessageParams): Promise<Message> {
    const message: Message = { ...params }
    this.messages.push(message)
    return Promise.resolve(message)
  }
}

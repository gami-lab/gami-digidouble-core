import type { Message, MessageMetadata } from '../../domain/conversation/session.types.js'

/** Port: message persistence. Infrastructure must implement this interface. */
export interface IMessageRepository {
  findBySessionId(sessionId: string, options?: FindMessagesOptions): Promise<Message[]>
  save(params: SaveMessageParams): Promise<Message>
}

export interface FindMessagesOptions {
  limit?: number
}

export interface SaveMessageParams {
  messageId: string
  sessionId: string
  role: Message['role']
  content: string
  createdAt: string
  metadata?: MessageMetadata
}

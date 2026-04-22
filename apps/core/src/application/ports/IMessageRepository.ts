import type { Message, MessageMetadata } from '../../domain/conversation/session.types.js'

/** Port: message persistence. Infrastructure must implement this interface. */
export interface IMessageRepository {
  findByConversationId(conversationId: string, options?: FindMessagesOptions): Promise<Message[]>
  save(params: SaveMessageParams): Promise<Message>
  deleteByConversationId(conversationId: string): Promise<number>
}

export interface FindMessagesOptions {
  limit?: number
}

export interface SaveMessageParams {
  messageId: string
  conversationId: string
  role: Message['role']
  content: string
  createdAt: string
  metadata?: MessageMetadata
}

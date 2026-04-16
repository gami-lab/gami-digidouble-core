import type { Message, MessageMetadata } from '../../domain/conversation/session.types.js'

/** Port: message persistence. Infrastructure must implement this interface. */
export interface IMessageRepository {
  findBySessionId(sessionId: string): Promise<Message[]>
  create(params: CreateMessageParams): Promise<Message>
}

export interface CreateMessageParams {
  sessionId: string
  role: Message['role']
  content: string
  metadata?: MessageMetadata
}

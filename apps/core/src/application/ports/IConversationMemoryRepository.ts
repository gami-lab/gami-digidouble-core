import type { ConversationMemory } from '../../domain/memory/memory.types.js'

export interface IConversationMemoryRepository {
  findByConversationId(conversationId: string): Promise<ConversationMemory | null>
  create(memory: Omit<ConversationMemory, 'createdAt'>): Promise<ConversationMemory>
  listByScope(input: {
    userId: string
    avatarId: string
    scenarioId: string
    limit: number
  }): Promise<ConversationMemory[]>
  deleteBySessionId(sessionId: string): Promise<number>
}

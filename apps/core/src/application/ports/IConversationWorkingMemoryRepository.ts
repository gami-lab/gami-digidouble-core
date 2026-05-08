import type { ConversationWorkingMemory } from '../../domain/memory/memory.types.js'

export interface IConversationWorkingMemoryRepository {
  findByConversationId(conversationId: string): Promise<ConversationWorkingMemory | null>
  upsert(memory: Omit<ConversationWorkingMemory, 'updatedAt'>): Promise<ConversationWorkingMemory>
  deleteBySessionId(sessionId: string): Promise<number>
}

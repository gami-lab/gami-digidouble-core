import type { IConversationWorkingMemoryRepository } from '../../application/ports/IConversationWorkingMemoryRepository.js'
import type { ConversationWorkingMemory } from '../../domain/memory/memory.types.js'

export class InMemoryConversationWorkingMemoryRepository implements IConversationWorkingMemoryRepository {
  private readonly memories: Map<string, ConversationWorkingMemory>

  constructor(initialData: ConversationWorkingMemory[] = []) {
    this.memories = new Map(initialData.map((memory) => [memory.conversationId, memory]))
  }

  findByConversationId(conversationId: string): Promise<ConversationWorkingMemory | null> {
    return Promise.resolve(this.memories.get(conversationId) ?? null)
  }

  upsert(memory: Omit<ConversationWorkingMemory, 'updatedAt'>): Promise<ConversationWorkingMemory> {
    const now = new Date().toISOString()
    const current = this.memories.get(memory.conversationId)
    const next: ConversationWorkingMemory = {
      ...memory,
      updatedAt: current?.updatedAt ?? now,
    }
    if (current !== undefined) {
      next.updatedAt = now
    }
    this.memories.set(memory.conversationId, next)
    return Promise.resolve(next)
  }

  deleteBySessionId(sessionId: string): Promise<number> {
    let deleted = 0
    for (const [key, value] of this.memories.entries()) {
      if (value.sessionId === sessionId) {
        this.memories.delete(key)
        deleted += 1
      }
    }
    return Promise.resolve(deleted)
  }
}

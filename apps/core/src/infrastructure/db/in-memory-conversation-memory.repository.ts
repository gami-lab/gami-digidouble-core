import type { IConversationMemoryRepository } from '../../application/ports/IConversationMemoryRepository.js'
import type { ConversationMemory } from '../../domain/memory/memory.types.js'

export class InMemoryConversationMemoryRepository implements IConversationMemoryRepository {
  private readonly memories: Map<string, ConversationMemory>

  constructor(initialData: ConversationMemory[] = []) {
    this.memories = new Map(initialData.map((memory) => [memory.conversationId, memory]))
  }

  findByConversationId(conversationId: string): Promise<ConversationMemory | null> {
    return Promise.resolve(this.memories.get(conversationId) ?? null)
  }

  create(memory: Omit<ConversationMemory, 'createdAt'>): Promise<ConversationMemory> {
    const existing = this.memories.get(memory.conversationId)
    if (existing !== undefined) return Promise.resolve(existing)
    const created: ConversationMemory = { ...memory, createdAt: new Date().toISOString() }
    this.memories.set(memory.conversationId, created)
    return Promise.resolve(created)
  }

  listByScope(input: {
    userId: string
    avatarId: string
    scenarioId: string
    limit: number
  }): Promise<ConversationMemory[]> {
    const result = [...this.memories.values()]
      .filter(
        (memory) =>
          memory.userId === input.userId &&
          memory.avatarId === input.avatarId &&
          memory.scenarioId === input.scenarioId,
      )
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, input.limit)
    return Promise.resolve(result)
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

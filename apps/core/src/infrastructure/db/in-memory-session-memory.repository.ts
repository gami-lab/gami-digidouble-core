import type { ISessionMemoryRepository } from '../../application/ports/ISessionMemoryRepository.js'
import type { SessionMemory } from '../../domain/memory/memory.types.js'

export class InMemorySessionMemoryRepository implements ISessionMemoryRepository {
  private readonly memories: Map<string, SessionMemory>

  constructor(initialData: SessionMemory[] = []) {
    this.memories = new Map(initialData.map((memory) => [memory.sessionId, memory]))
  }

  findBySessionId(sessionId: string): Promise<SessionMemory | null> {
    return Promise.resolve(this.memories.get(sessionId) ?? null)
  }

  upsert(memory: Omit<SessionMemory, 'updatedAt'>): Promise<SessionMemory> {
    const now = new Date().toISOString()
    const current = this.memories.get(memory.sessionId)
    const next: SessionMemory = {
      sessionId: memory.sessionId,
      summary: memory.summary,
      updatedAt: current?.updatedAt ?? now,
    }

    if (current !== undefined) {
      next.updatedAt = now
    }

    this.memories.set(memory.sessionId, next)
    return Promise.resolve(next)
  }

  deleteBySessionId(sessionId: string): Promise<boolean> {
    return Promise.resolve(this.memories.delete(sessionId))
  }
}

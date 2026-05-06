import type { IAvatarSessionMemoryRepository } from '../../application/ports/IAvatarSessionMemoryRepository.js'
import type { AvatarSessionMemory } from '../../domain/memory/memory.types.js'

function toKey(sessionId: string, avatarId: string): string {
  return `${sessionId}::${avatarId}`
}

export class InMemoryAvatarSessionMemoryRepository implements IAvatarSessionMemoryRepository {
  private readonly memories: Map<string, AvatarSessionMemory>

  constructor(initialData: AvatarSessionMemory[] = []) {
    this.memories = new Map(
      initialData.map((memory) => [toKey(memory.sessionId, memory.avatarId), memory]),
    )
  }

  findBySessionIdAndAvatarId(
    sessionId: string,
    avatarId: string,
  ): Promise<AvatarSessionMemory | null> {
    return Promise.resolve(this.memories.get(toKey(sessionId, avatarId)) ?? null)
  }

  listBySessionId(sessionId: string): Promise<AvatarSessionMemory[]> {
    const memories = Array.from(this.memories.values()).filter(
      (memory) => memory.sessionId === sessionId,
    )
    return Promise.resolve(
      memories.sort((a, b) => {
        if (a.updatedAt !== b.updatedAt) {
          return Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
        }
        return a.avatarId.localeCompare(b.avatarId)
      }),
    )
  }

  upsert(memory: Omit<AvatarSessionMemory, 'updatedAt'>): Promise<AvatarSessionMemory> {
    const key = toKey(memory.sessionId, memory.avatarId)
    const now = new Date().toISOString()
    const current = this.memories.get(key)
    const next: AvatarSessionMemory = {
      sessionId: memory.sessionId,
      avatarId: memory.avatarId,
      summary: memory.summary,
      updatedAt: current?.updatedAt ?? now,
    }

    if (current !== undefined) {
      next.updatedAt = now
    }

    this.memories.set(key, next)
    return Promise.resolve(next)
  }

  deleteBySessionId(sessionId: string): Promise<number> {
    let deleted = 0
    for (const [key, memory] of this.memories.entries()) {
      if (memory.sessionId === sessionId) {
        this.memories.delete(key)
        deleted += 1
      }
    }
    return Promise.resolve(deleted)
  }
}

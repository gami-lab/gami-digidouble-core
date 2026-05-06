import type { AvatarSessionMemory } from '../../domain/memory/memory.types.js'

export interface IAvatarSessionMemoryRepository {
  findBySessionIdAndAvatarId(
    sessionId: string,
    avatarId: string,
  ): Promise<AvatarSessionMemory | null>
  listBySessionId(sessionId: string): Promise<AvatarSessionMemory[]>
  upsert(memory: Omit<AvatarSessionMemory, 'updatedAt'>): Promise<AvatarSessionMemory>
  deleteBySessionId(sessionId: string): Promise<number>
}

import type { SessionMemory } from '../../domain/memory/memory.types.js'

export interface ISessionMemoryRepository {
  findBySessionId(sessionId: string): Promise<SessionMemory | null>
  upsert(memory: Omit<SessionMemory, 'updatedAt'>): Promise<SessionMemory>
  deleteBySessionId(sessionId: string): Promise<boolean>
}

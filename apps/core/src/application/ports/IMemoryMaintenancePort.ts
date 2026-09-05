import type { VerifiedMemoryContext } from '../../domain/memory/memory.types.js'

export type MemoryRefreshTrigger =
  'post_turn' | 'conversation_closed' | 'avatar_switch' | 'admin_trigger'

export interface IMemoryMaintenancePort {
  execute(input: {
    sessionId: string
    conversationId: string
    avatarId: string
    scenarioId: string
    trigger: MemoryRefreshTrigger
    correlationId?: string
    verifiedContext?: VerifiedMemoryContext[]
  }): Promise<void>
  awaitPendingRefresh?(conversationId: string): Promise<void>
}

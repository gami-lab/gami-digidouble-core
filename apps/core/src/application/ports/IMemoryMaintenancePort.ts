export type MemoryRefreshTrigger = 'post_turn' | 'conversation_closed'

export interface IMemoryMaintenancePort {
  execute(input: {
    sessionId: string
    conversationId: string
    avatarId: string
    trigger: MemoryRefreshTrigger
    correlationId?: string
  }): Promise<void>
}

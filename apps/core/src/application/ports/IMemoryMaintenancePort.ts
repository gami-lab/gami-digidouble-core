export type MemoryRefreshTrigger =
  | 'post_turn'
  | 'conversation_closed'
  | 'avatar_switch'
  | 'admin_trigger'

export interface IMemoryMaintenancePort {
  execute(input: {
    sessionId: string
    conversationId: string
    avatarId: string
    trigger: MemoryRefreshTrigger
    correlationId?: string
  }): Promise<void>
  awaitPendingRefresh?(conversationId: string): Promise<void>
}

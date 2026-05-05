export type RuntimeEvent = {
  eventId: string
  sessionId: string
  conversationId?: string
  type:
    | 'runtime.processing_started'
    | 'runtime.processing_finished'
    | 'runtime.avatar_unlocked'
    | 'runtime.avatar_suggested'
    | 'runtime.choice_required'
    | 'runtime.session_closed'
  occurredAt: string
  correlationId?: string
  payload: Record<string, unknown>
}

export type RuntimeState = {
  sessionId: string
  conversationId?: string
  canSendMessage: boolean
  isProcessing: boolean
  pendingEvent?: RuntimeEvent
  updatedAt: string
}

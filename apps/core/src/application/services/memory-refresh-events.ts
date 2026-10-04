// Shared envelope for memory_refresh_* events so triggered/succeeded/failed stay aligned.
export type MemoryRefreshEventInput = {
  sessionId: string
  conversationId: string
  avatarId: string
  scenarioId: string
  trigger: 'post_turn' | 'conversation_closed' | 'avatar_switch' | 'admin_trigger'
  correlationId?: string
}

export function memoryRefreshEventBase(
  input: MemoryRefreshEventInput,
  requestId: string,
): { sessionId: string; requestId: string; correlationId?: string } {
  return {
    sessionId: input.sessionId,
    requestId,
    ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
  }
}

export function memoryRefreshPayloadBase(input: MemoryRefreshEventInput): Record<string, unknown> {
  return {
    sessionId: input.sessionId,
    conversationId: input.conversationId,
    avatarId: input.avatarId,
    scenarioId: input.scenarioId,
    trigger: input.trigger,
  }
}

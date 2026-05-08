import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'

export function emitTurnCompletedEventNonBlocking(args: {
  requestId: string
  sessionId: string
  conversationId: string
  turnIndex: number
  avatarId: string
  avatarLatencyMs: number
  totalTurnLatencyMs: number
  inputTokens: number
  outputTokens: number
  model: string
  hasGm: boolean
  eventLogRepository: IEventLogRepository
}): void {
  const payload = {
    correlationId: args.requestId,
    conversationId: args.conversationId,
    turnIndex: args.turnIndex,
    avatarId: args.avatarId,
    avatarLatencyMs: args.avatarLatencyMs,
    totalTurnLatencyMs: args.totalTurnLatencyMs,
    inputTokens: args.inputTokens,
    outputTokens: args.outputTokens,
    totalTokens: args.inputTokens + args.outputTokens,
    model: args.model,
    hasGm: args.hasGm,
  } as const

  void args.eventLogRepository
    .append({
      sessionId: args.sessionId,
      type: 'turn_completed',
      severity: 'info',
      correlationId: args.requestId,
      payload,
    })
    .catch((err: unknown) => {
      console.error('[send-message] Event log append failed for turn_completed:', err)
    })
}

import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'
import type { AvatarContextSnapshot } from '../../../domain/context/session-context.types.js'

export function emitTurnCompletedEventNonBlocking(args: {
  requestId: string
  sessionId: string
  conversationId: string
  turnIndex: number
  avatarId: string
  avatarContext: AvatarContextSnapshot
  avatarLatencyMs: number
  totalTurnLatencyMs: number
  inputTokens: number
  outputTokens: number
  model: string
  hasGm: boolean
  retrievalLatencyMs: number
  otherOverheadMs: number
  contextSelection: {
    shortTermExchangeCount: number
    hasWorkingMemory: boolean
    longTermFactCount: number
    retrievalCounts: {
      memory: number
      world: number
      media: number
    }
    visibility?: {
      activeAvatarId?: string
      excludedCounts: {
        memory: number
        world: number
        media: number
      }
      gmRetrievalCounts?: {
        memory: number
        world: number
        media: number
      }
      gmUnrestricted?: true
    }
    hasUserPersona: boolean
    hasGmDirective: boolean
  }
  eventLogRepository: IEventLogRepository
}): void {
  const payload = {
    correlationId: args.requestId,
    conversationId: args.conversationId,
    turnIndex: args.turnIndex,
    avatarId: args.avatarId,
    avatarContext: args.avatarContext,
    avatarLatencyMs: args.avatarLatencyMs,
    totalTurnLatencyMs: args.totalTurnLatencyMs,
    inputTokens: args.inputTokens,
    outputTokens: args.outputTokens,
    totalTokens: args.inputTokens + args.outputTokens,
    model: args.model,
    hasGm: args.hasGm,
    retrievalLatencyMs: args.retrievalLatencyMs,
    otherOverheadMs: args.otherOverheadMs,
    contextSelection: args.contextSelection,
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

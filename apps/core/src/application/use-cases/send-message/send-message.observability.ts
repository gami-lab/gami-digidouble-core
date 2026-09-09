import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'
import type { ConsumedGmRetrievalPlan } from '@gami/shared'
import type { AvatarContextSnapshot } from '../../../domain/context/session-context.types.js'
import { toRecordedAvatarContextSnapshot } from '../../services/runtime-inspector-event-context.js'
import type { ContextSelectionMetadata } from './send-message.context-selection.js'

export function emitTurnCompletedEventNonBlocking(args: {
  requestId: string
  sessionId: string
  conversationId: string
  turnIndex: number
  avatarId: string
  consumedGmRetrievalPlan?: ConsumedGmRetrievalPlan
  avatarContext: AvatarContextSnapshot
  avatarLatencyMs: number
  totalTurnLatencyMs: number
  inputTokens: number
  outputTokens: number
  model: string
  hasGm: boolean
  retrievalLatencyMs: number
  otherOverheadMs: number
  contextSelection: ContextSelectionMetadata
  eventLogRepository: IEventLogRepository
}): void {
  const payload = {
    correlationId: args.requestId,
    conversationId: args.conversationId,
    turnIndex: args.turnIndex,
    avatarId: args.avatarId,
    ...(args.consumedGmRetrievalPlan !== undefined
      ? { consumedGmRetrievalPlan: args.consumedGmRetrievalPlan }
      : {}),
    avatarContext: toRecordedAvatarContextSnapshot(args.avatarContext),
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

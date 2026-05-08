import type { ConversationEndReason, EndConversationResponse } from '@gami/shared'
import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'
import {
  detectImplicitEndReason,
  type ImplicitEndPolicy,
} from '../../services/implicit-end-detection.service.js'

type ConversationCloser = {
  execute(input: {
    sessionId: string
    conversationId: string
    reason?: ConversationEndReason
  }): Promise<EndConversationResponse>
}

export async function tryImplicitClose(args: {
  endConversationUseCase: ConversationCloser | null
  eventLogRepository: IEventLogRepository
  implicitEndPolicy: ImplicitEndPolicy
  requestId: string
  sessionId: string
  conversationId: string
  userMessage: string
  lastActivityAtBeforeTurn: string
  now: string
}): Promise<EndConversationResponse | null> {
  if (args.endConversationUseCase === null) return null

  const reason = detectImplicitEndReason({
    userMessage: args.userMessage,
    lastActivityAt: args.lastActivityAtBeforeTurn,
    now: args.now,
    policy: args.implicitEndPolicy,
  })
  if (reason === null) return null

  await appendEventSafe(args.eventLogRepository, {
    sessionId: args.sessionId,
    type: 'implicit_end_detected',
    severity: 'info',
    requestId: args.requestId,
    payload: { conversationId: args.conversationId, reason },
  })

  try {
    const closed = await args.endConversationUseCase.execute({
      sessionId: args.sessionId,
      conversationId: args.conversationId,
      reason,
    })
    await appendEventSafe(args.eventLogRepository, {
      sessionId: args.sessionId,
      type: 'implicit_end_closed',
      severity: 'info',
      requestId: args.requestId,
      payload: { conversationId: args.conversationId, reason },
    })
    return closed
  } catch (error) {
    await appendEventSafe(args.eventLogRepository, {
      sessionId: args.sessionId,
      type: 'implicit_end_skipped',
      severity: 'warning',
      requestId: args.requestId,
      payload: {
        conversationId: args.conversationId,
        reason,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    })
    return null
  }
}

async function appendEventSafe(
  eventLogRepository: IEventLogRepository,
  args: Parameters<IEventLogRepository['append']>[0],
): Promise<void> {
  try {
    await eventLogRepository.append(args)
  } catch (error) {
    console.error('[send-message] Event log append failed:', error)
  }
}

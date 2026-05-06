import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'
import type { IObservabilityAdapter } from '../../ports/IObservabilityAdapter.js'

export function traceNonBlocking(args: {
  requestId: string
  sessionId: string
  llmRequest: {
    systemPrompt: string
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  }
  response: { content: string; model: string; inputTokens: number; outputTokens: number }
  latencyMs: number
  observability: IObservabilityAdapter
}): void {
  void args.observability
    .trace({
      requestId: args.requestId,
      sessionId: args.sessionId,
      event: 'llm.completion',
      input: {
        systemPrompt: args.llmRequest.systemPrompt,
        messages: args.llmRequest.messages,
      },
      output: args.response.content,
      latencyMs: args.latencyMs,
      inputTokens: args.response.inputTokens,
      outputTokens: args.response.outputTokens,
      metadata: { model: args.response.model },
    })
    .catch((err: unknown) => {
      console.error('[send-message] Observability trace failed:', err)
    })
}

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

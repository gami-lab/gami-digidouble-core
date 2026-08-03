/**
 * Port: LLM provider abstraction.
 *
 * All LLM calls in business logic go through this interface.
 * Never call provider SDKs directly from domain or application code.
 * Concrete adapters live in infrastructure/llm/.
 */
export interface LlmRequest {
  systemPrompt: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  /** Optional model override — defaults to role-assigned model. */
  model?: string
  /** Optional low-latency processing tier; currently supported by OpenAI adapters. */
  serviceTier?: 'fast'
  /** Optional max output tokens hint for provider adapters. */
  maxTokens?: number
  /** Optional observability context consumed by the observed adapter wrapper. */
  trace?: {
    requestId?: string
    sessionId?: string
    event?: string
    errorEvent?: string
    metadata?: Record<string, unknown>
  }
}

export interface LlmResponse {
  content: string
  model: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
}

export interface LlmStreamOptions {
  signal?: AbortSignal
}

export interface LlmStreamDeltaEvent {
  type: 'delta'
  text: string
}

export interface LlmStreamCompletedEvent {
  type: 'completed'
  response: LlmResponse
}

export type LlmStreamEvent = LlmStreamDeltaEvent | LlmStreamCompletedEvent

export interface ILlmAdapter {
  complete(request: LlmRequest): Promise<LlmResponse>
  stream?(request: LlmRequest, options?: LlmStreamOptions): AsyncIterable<LlmStreamEvent>
}

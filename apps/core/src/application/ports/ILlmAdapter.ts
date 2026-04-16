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
}

export interface LlmResponse {
  content: string
  model: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
}

export interface ILlmAdapter {
  complete(request: LlmRequest): Promise<LlmResponse>
}

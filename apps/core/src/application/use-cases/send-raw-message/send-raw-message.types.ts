import type { LlmResponse } from '../../ports/ILlmAdapter.js'

export interface SendRawMessageInput {
  userMessage: string
  /** Optional system prompt override; defaults to a plain assistant prompt. */
  systemPrompt?: string
  /** Optional model override; defaults to the configured provider model. */
  model?: string
  /** Optional provider processing tier. */
  serviceTier?: 'fast'
}

export interface SendRawMessageOutput extends Pick<
  LlmResponse,
  'model' | 'latencyMs' | 'inputTokens' | 'outputTokens'
> {
  requestId: string
  reply: string
}

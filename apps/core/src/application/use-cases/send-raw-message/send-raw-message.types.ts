import type { LlmResponse } from '../../ports/ILlmAdapter.js'

export interface SendRawMessageInput {
  userMessage: string
  /** Optional system prompt override; defaults to a plain assistant prompt. */
  systemPrompt?: string
}

export interface SendRawMessageOutput extends Pick<
  LlmResponse,
  'model' | 'latencyMs' | 'inputTokens' | 'outputTokens'
> {
  requestId: string
  reply: string
}

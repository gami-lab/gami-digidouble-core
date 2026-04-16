export interface SendRawMessageInput {
  userMessage: string
  /** Optional system prompt override; defaults to a plain assistant prompt. */
  systemPrompt?: string
}

export interface SendRawMessageOutput {
  requestId: string
  reply: string
  model: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
}

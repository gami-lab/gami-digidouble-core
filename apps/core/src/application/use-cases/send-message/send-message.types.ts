export interface SendMessageInput {
  sessionId: string
  avatarId: string
  userMessage: string
}

export interface SendMessageOutput {
  requestId: string
  sessionId: string
  userMessage: {
    messageId: string
    content: string
    createdAt: string
  }
  avatarMessage: {
    messageId: string
    content: string
    createdAt: string
    model: string
    inputTokens: number
    outputTokens: number
    latencyMs: number
  }
}

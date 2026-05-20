export function buildSendMessageLlmRequest(args: {
  requestId: string
  sessionId: string
  conversationId: string
  avatarId: string
  systemPrompt: string
  historyMessages: Array<{ role: 'user' | 'assistant'; content: string }>
  userMessage: string
  model?: string
  effectiveProvider: string
  effectiveModel: string
}): {
  systemPrompt: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  model?: string
  trace: {
    requestId: string
    sessionId: string
    metadata: {
      surface: 'send_message'
      conversationId: string
      avatarId: string
      effectiveProvider: string
      effectiveModel: string
    }
  }
} {
  return {
    systemPrompt: args.systemPrompt,
    messages: [...args.historyMessages, { role: 'user' as const, content: args.userMessage }],
    ...(args.model !== undefined ? { model: args.model } : {}),
    trace: {
      requestId: args.requestId,
      sessionId: args.sessionId,
      metadata: {
        surface: 'send_message',
        conversationId: args.conversationId,
        avatarId: args.avatarId,
        effectiveProvider: args.effectiveProvider,
        effectiveModel: args.effectiveModel,
      },
    },
  }
}

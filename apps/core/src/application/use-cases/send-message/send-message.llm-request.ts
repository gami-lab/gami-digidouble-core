export function buildSendMessageLlmRequest(args: {
  requestId: string
  sessionId: string
  conversationId: string
  avatarId: string
  systemPrompt: string
  historyMessages: Array<{ role: 'user' | 'assistant'; content: string }>
  userMessage: string
}): {
  systemPrompt: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  trace: {
    requestId: string
    sessionId: string
    metadata: {
      surface: 'send_message'
      conversationId: string
      avatarId: string
    }
  }
} {
  return {
    systemPrompt: args.systemPrompt,
    messages: [...args.historyMessages, { role: 'user' as const, content: args.userMessage }],
    trace: {
      requestId: args.requestId,
      sessionId: args.sessionId,
      metadata: {
        surface: 'send_message',
        conversationId: args.conversationId,
        avatarId: args.avatarId,
      },
    },
  }
}

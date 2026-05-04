export interface IConversationCompactionPort {
  compactConversation(input: {
    sessionId: string
    conversationId: string
  }): Promise<{ summary: string }>
}

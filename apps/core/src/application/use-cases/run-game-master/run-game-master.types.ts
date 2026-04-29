export type RunGameMasterInput = {
  sessionId: string
  scenarioId: string
  avatarId: string
  conversationId?: string
  userMessageText: string
  turnIndex: number
  correlationId: string
}

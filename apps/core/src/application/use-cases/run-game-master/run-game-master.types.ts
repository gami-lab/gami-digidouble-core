import type { UserPersona } from '../../../domain/user/user.types.js'

export type RunGameMasterInput = {
  sessionId: string
  scenarioId: string
  avatarId: string
  conversationId?: string
  userMessageText: string
  turnIndex: number
  correlationId: string
  userPersona?: UserPersona
}

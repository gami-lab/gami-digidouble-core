import type { UserPersona } from '../../../domain/user/user.types.js'
import type { SelectedMemoryPayload } from '../../../domain/memory/memory.types.js'

export type RunGameMasterInput = {
  sessionId: string
  scenarioId: string
  avatarId: string
  conversationId?: string
  userMessageText: string
  turnIndex: number
  correlationId: string
  userPersona?: UserPersona
  selectedMemory?: SelectedMemoryPayload
}

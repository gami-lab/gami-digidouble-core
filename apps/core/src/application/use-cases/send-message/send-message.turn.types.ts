import type { ILlmAdapter, LlmRequest, LlmResponse } from '../../ports/ILlmAdapter.js'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { Conversation, Message, Session } from '../../../domain/conversation/session.types.js'
import type { UserPersona } from '../../../domain/user/user.types.js'
import type { SelectedMemoryPayload } from '../../../domain/memory/memory.types.js'
import type { ContextEngineOutput } from '../../../domain/context/context-engine.types.js'
import type { GameMasterOrchestrationState } from '../../../domain/game-master/game-master.types.js'
import type { SendMessageInput } from './send-message.types.js'

export interface PreparedSendMessageTurn {
  requestId: string
  startedAtMs: number
  input: SendMessageInput
  conversation: Conversation
  session: Session
  avatar: AvatarConfig
  userMessage: Message
  userPersona: UserPersona | undefined
  selectedMemory: SelectedMemoryPayload | undefined
  orchestration: GameMasterOrchestrationState | undefined
  assembledContext: ContextEngineOutput
  retrievalLatencyMs: number
  priorUserTurnCount: number
  adapter: ILlmAdapter
  llmRequest: LlmRequest
}

export type SendMessageTurnResponse = LlmResponse

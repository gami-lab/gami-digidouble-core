export { ApiError, coreRequest } from './client'
export { createAvatar, createScenario } from './scenarios'
export { sendMessage } from './messages'
export { getHistory, startConversation, startSession } from './sessions'

export type { SendMessageParams, SendMessageResponse } from './messages'
export type {
  AvatarSummary,
  CreateAvatarParams,
  CreateScenarioParams,
  ScenarioSummary,
} from './scenarios'
export type {
  GetHistoryResponse,
  Message,
  ConversationSummary,
  SessionSummary,
  StartConversationParams,
  StartSessionParams,
} from './sessions'

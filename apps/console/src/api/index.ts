export { ApiError, coreRequest } from './client'
export { createAvatar, createScenario, listScenarioAvatars, listScenarios } from './scenarios'
export { sendMessage } from './messages'
export {
  getHistory,
  getSession,
  listSessionConversations,
  startConversation,
  startSession,
} from './sessions'

export type { SendMessageParams, SendMessageResponse } from './messages'
export type {
  AvatarSummary,
  CreateAvatarParams,
  CreateScenarioParams,
  ScenarioSummary,
} from './scenarios'
export type {
  ConversationSummary,
  GetHistoryResponse,
  Message,
  SessionSummary,
  StartConversationParams,
  StartSessionParams,
} from './sessions'

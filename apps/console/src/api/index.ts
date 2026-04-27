export { ApiError, coreRequest } from './client'
export { createAvatar, createScenario, listScenarioAvatars, listScenarios } from './scenarios'
export { sendMessage } from './messages'
export {
  getAvailableAvatars,
  getHistory,
  getSession,
  listSessionConversations,
  startConversation,
  startSession,
  switchAvatar,
} from './sessions'

export type { SendMessageParams, SendMessageResponse } from './messages'
export type {
  AvatarSummary,
  CreateAvatarParams,
  CreateScenarioParams,
  ScenarioSummary,
} from './scenarios'
export type {
  AvailableAvatarSummary,
  ConversationSummary,
  GetAvailableAvatarsResponse,
  GetHistoryResponse,
  Message,
  SessionSummary,
  StartConversationParams,
  StartSessionParams,
  SwitchAvatarResponse,
} from './sessions'

export { ApiError, coreRequest } from './client'
export {
  createAvatar,
  createScenario,
  deleteAvatar,
  deleteScenario,
  listScenarioAvatars,
  listScenarios,
  updateAvatar,
  updateScenario,
} from './scenarios'
export { sendMessage } from './messages'
export {
  getAvailableAvatars,
  getHistory,
  getSession,
  inspectSession,
  listSessionConversations,
  listSessionEvents,
  listSessions,
  resetSession,
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
  GmStateSummary,
  InspectSessionResponse,
  ListSessionEventsResponse,
  ListSessionsFilter,
  Message,
  SessionEventRecord,
  SessionSummary,
  SessionTransitionRecord,
  StartConversationParams,
  StartSessionParams,
  SwitchAvatarResponse,
} from './sessions'

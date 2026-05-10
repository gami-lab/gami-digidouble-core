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
export { loadRuntimeInspectorViewModel } from './runtime-inspector'
export { subscribeToRuntimeEvents } from './runtime-events-stream'
export {
  clearSessionMemory,
  endConversation,
  getRuntimeState,
  getSessionContext,
  getSessionMemory,
  getSessionMemoryLayers,
  getSessionMetrics,
  getAvailableAvatars,
  getHistory,
  refreshSessionMemory,
  replayGm,
  getSession,
  getUserPersona,
  inspectSession,
  listSessionConversations,
  listSessionEvents,
  listSessions,
  resetSession,
  startConversation,
  startSession,
  switchAvatar,
  upsertUserPersona,
} from './sessions'

export type { SendMessageParams, SendMessageResponse } from './messages'
export type { RuntimeInspectorQueryOptions, RuntimeInspectorViewModel } from './runtime-inspector'
export type {
  AvatarSummary,
  CreateAvatarParams,
  CreateScenarioParams,
  ScenarioSummary,
} from './scenarios'
export type {
  AvailableAvatarSummary,
  ConversationEndReason,
  ConversationSummary,
  EndConversationResponse,
  GetAvailableAvatarsResponse,
  GetHistoryResponse,
  AdminSessionMemoryLayersResponse,
  AdminSessionMemoryResponse,
  AdminSessionTurnMetricsResponse,
  UserPersonaResponse,
  AdminSessionContextResponse,
  GmStateSummary,
  AdminSessionInspectResponse,
  AdminSessionEventsResponse,
  ListSessionsFilter,
  Message,
  RuntimeState,
  SessionEventRecord,
  SessionSummary,
  SessionTransitionRecord,
  StartConversationParams,
  StartSessionParams,
  SwitchAvatarResponse,
  AdminReplayGmResponse,
  AdminRefreshMemoryResponse,
  AdminClearMemoryResponse,
  UpsertUserPersonaResponse,
} from './sessions'

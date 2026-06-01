import type {
  AvatarSummary,
  ConversationSummary,
  LifecycleStatus,
  ScenarioSummary,
  SessionSummary,
  UpdateAvatarRequest,
} from './entity-types.js'
import type {
  GetAvailableAvatarsResponse,
  GetHistoryResponse as ConversationHistoryResponse,
  SendMessageResponse,
  SwitchAvatarResponse,
} from './conversation-contract-types.js'
import type { ConversationEndReason, EndConversationResponse } from './lifecycle-types.js'
import type {
  UpsertUserPersonaResponse,
  UserPersona,
  UserPersonaResponse,
} from './runtime-inspector-types.js'

export type ListScenariosResponse = {
  scenarios: ScenarioSummary[]
}

export type CreateScenarioRequest = {
  name: string
  status?: ScenarioSummary['status']
  config?: Record<string, unknown>
}

export type CreateScenarioResponse = {
  scenario: ScenarioSummary
}

export type UpdateScenarioRequest = Partial<Pick<ScenarioSummary, 'name' | 'status'>>

export type UpdateScenarioResponse = {
  scenario: ScenarioSummary
}

export type DeleteScenarioResponse = {
  scenarioId: string
  deleted: true
}

export type ListScenarioAvatarsResponse = {
  avatars: AvatarSummary[]
}

export type CreateAvatarForScenarioRequest = {
  scenarioId: string
  avatar: {
    name: string
    personaPrompt: string
    tone?: string
    description?: string
    adjustments?: string[]
    llmOverride?: { provider?: string; model?: string } | null
    config?: Record<string, unknown>
    status?: AvatarSummary['status']
  }
}

export type CreateAvatarResponse = {
  avatar: AvatarSummary
}

export type UpdateAvatarResponse = {
  avatar: AvatarSummary
}

export type DeleteAvatarResponse = {
  avatarId: string
  deleted: true
}

export type StartSessionRequest = {
  userId: string
  scenarioId: string
}

export type StartSessionResponse = {
  session: SessionSummary
}

export type GetSessionResponse = {
  session: SessionSummary
}

export type ListSessionsQuery = {
  scenarioId?: string
  userId?: string
  status?: LifecycleStatus
}

export type ListSessionsResponse = {
  sessions: SessionSummary[]
}

export type ResetSessionResponse = {
  session: SessionSummary
}

export type StartConversationRequest = {
  avatarId: string
}

export type StartConversationResponse = {
  conversation: ConversationSummary
}

export type ListSessionConversationsResponse = {
  conversations: ConversationSummary[]
}

export type EndConversationRequest = {
  reason?: ConversationEndReason
}

export type ConversationHistoryApiResponse = ConversationHistoryResponse

export type GetAvailableAvatarsApiResponse = GetAvailableAvatarsResponse

export type SwitchAvatarApiResponse = SwitchAvatarResponse

export type SendMessageRequest = {
  message: {
    content: string
  }
}

export type SendMessageApiResponse = SendMessageResponse

export type GetUserPersonaResponse = UserPersonaResponse

export type UpsertUserPersonaRequest = UserPersona

export type UpsertUserPersonaApiResponse = UpsertUserPersonaResponse

export type EndConversationApiResponse = EndConversationResponse

export type UpdateAvatarRequestBody = UpdateAvatarRequest

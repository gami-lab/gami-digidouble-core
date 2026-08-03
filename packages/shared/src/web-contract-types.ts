import type {
  AvatarComputedTraits,
  AvatarSummary,
  ConversationSummary,
  LifecycleStatus,
  ScenarioAvatarAvailability,
  ScenarioModelSelection,
  ScenarioSummary,
  SessionSummary,
} from './entity-types.js'
import type {
  GetAvailableAvatarsResponse,
  GetHistoryResponse as ConversationHistoryResponse,
  SendMessageResponse,
  SwitchAvatarResponse,
} from './conversation-contract-types.js'
import type { ConversationEndReason, EndConversationResponse } from './lifecycle-types.js'
import type { ModelSelectionOverride } from './model-catalog.js'
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
  objectives?: string[]
  worldContext?: string
  avatarAvailability?: ScenarioAvatarAvailability
  modelSelection?: ScenarioModelSelection
  config?: Record<string, unknown>
}

export type CreateScenarioResponse = {
  scenario: ScenarioSummary
}

export type UpdateScenarioRequest = {
  name?: ScenarioSummary['name']
  status?: ScenarioSummary['status']
  objectives?: ScenarioSummary['objectives']
  worldContext?: ScenarioSummary['worldContext']
  avatarAvailability?: ScenarioAvatarAvailability
  modelSelection?: ScenarioModelSelection | null
  config?: Record<string, unknown>
}

export type UpdateScenarioResponse = {
  scenario: ScenarioSummary
}

export type GetScenarioResponse = {
  scenario: ScenarioSummary
}

export type DeleteScenarioResponse = {
  scenarioId: string
  deleted: true
}

export type ListScenarioAvatarsResponse = {
  avatars: AvatarSummary[]
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

export type AvatarTraitPreparationFailureReason =
  | 'unparseable_output'
  | 'llm_error'
  | 'persistence_error'
  | 'unknown_error'

/**
 * Per-avatar outcome of an explicit scenario-scoped trait preparation run
 * (EPIC 8.1). `prepared` carries the freshly persisted `computedTraits`;
 * `failed` isolates one avatar's error without failing the whole batch.
 */
export type AvatarTraitPreparationResult =
  | { avatarId: string; status: 'prepared'; computedTraits: AvatarComputedTraits }
  | { avatarId: string; status: 'failed'; reason: AvatarTraitPreparationFailureReason }

export type PrepareAvatarTraitsResponse = {
  scenarioId: string
  results: AvatarTraitPreparationResult[]
}

export type StartSessionRequest = {
  userId: string
  scenarioId: string
  model?: ModelSelectionOverride
  avatarOptions?: AvatarRequestOptions
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

export const AVATAR_RETRIEVAL_DEFAULT_MAX_CHUNKS = 7
export const AVATAR_RETRIEVAL_MAX_CHUNKS = 9
export const AVATAR_RETRIEVAL_MINIMUM_CHUNKS = 0

export type AvatarRetrievalSource = 'gm_required_fact' | 'gm_retrieval_query' | 'last_user_input'

export const AVATAR_RETRIEVAL_DEFAULT_MINIMUM_CHUNKS_BY_SOURCE = {
  gm_required_fact: 1,
  gm_retrieval_query: 1,
  last_user_input: 3,
} as const satisfies Record<AvatarRetrievalSource, number>

export type AvatarRetrievalOptions = {
  maxChunks?: number
  minimumChunksBySource?: Partial<Record<AvatarRetrievalSource, number>>
}

export type AvatarRequestOptions = {
  retrieval?: AvatarRetrievalOptions
}

// The future message-stream route reuses this request body unchanged.
export type SendMessageRequest = {
  message: {
    content: string
  }
  model?: ModelSelectionOverride
}

export type SendMessageApiResponse = SendMessageResponse

export type GetUserPersonaResponse = UserPersonaResponse

export type UpsertUserPersonaRequest = UserPersona

export type UpsertUserPersonaApiResponse = UpsertUserPersonaResponse

export type EndConversationApiResponse = EndConversationResponse

export type LocalWebIdentity = {
  version: 1
  userId: string
  persona: UserPersona
  createdAt: string
  updatedAt: string
}

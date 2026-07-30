import type {
  ApiError,
  ApiResponse,
  AvatarSummary,
  ConversationSummary,
  ListScenarioAvatarsResponse,
  Message,
  SendMessageApiResponse,
  SessionSummary,
  StartConversationRequest,
  StartConversationResponse,
  StartSessionRequest,
  StartSessionResponse,
} from '@gami/shared'
import type { ModelSelectionOverride } from '@gami/shared'

import type { EvaluationPhase } from './contracts.js'

type HttpMethod = 'GET' | 'POST'

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export type CoreApiClientOptions = {
  baseUrl: string
  apiKey: string
  timeoutMs: number
  fetchImpl?: FetchLike
}

export type CoreApiRequestOptions = {
  signal?: AbortSignal
}

export type CoreApiErrorKind = 'api_error' | 'transport_error' | 'contract_error'

export class CoreApiError extends Error {
  readonly status: number | null
  readonly code: string
  readonly path: string
  readonly kind: CoreApiErrorKind
  readonly safeMessage: string
  readonly phase: EvaluationPhase | undefined

  constructor(options: {
    status: number | null
    code: string
    message: string
    path: string
    kind: CoreApiErrorKind
    phase?: EvaluationPhase
  }) {
    const safeMessage = boundSafeMessage(options.message)
    super(safeMessage)
    this.name = 'CoreApiError'
    this.status = options.status
    this.code = options.code
    this.path = options.path
    this.kind = options.kind
    this.safeMessage = safeMessage
    this.phase = options.phase
  }
}

type ApiResponseError = Pick<ApiError, 'code' | 'message'>

const MAX_SAFE_MESSAGE_LENGTH = 500

function boundSafeMessage(message: string): string {
  const normalized = message.replace(/[\r\n\t]+/g, ' ').trim()
  if (normalized.length <= MAX_SAFE_MESSAGE_LENGTH) return normalized
  return `${normalized.slice(0, MAX_SAFE_MESSAGE_LENGTH - 1)}…`
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '')
}

function normalizePath(value: string): string {
  return value.startsWith('/') ? value : `/${value}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || isString(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString)
}

function hasRequiredStrings(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => isString(value[key]))
}

function hasOptionalStringProperty(value: Record<string, unknown>, key: string): boolean {
  return isOptionalString(value[key])
}

function hasOptionalStringArrayProperty(value: Record<string, unknown>, key: string): boolean {
  return value[key] === undefined || isStringArray(value[key])
}

function isLifecycleStatus(value: unknown): boolean {
  return value === 'active' || value === 'closed' || value === 'archived'
}

function isSessionSummary(value: unknown): value is SessionSummary {
  if (!isRecord(value)) return false
  return (
    ['sessionId', 'userId', 'scenarioId'].every((key) => isNonEmptyString(value[key])) &&
    isLifecycleStatus(value['status']) &&
    hasRequiredStrings(value, ['startedAt', 'lastActivityAt']) &&
    hasOptionalStringProperty(value, 'activeAvatarId') &&
    hasOptionalStringArrayProperty(value, 'unlockedAvatarIds') &&
    hasOptionalStringProperty(value, 'endedAt')
  )
}

function isConversationSummary(value: unknown): value is ConversationSummary {
  return (
    isRecord(value) &&
    isNonEmptyString(value['conversationId']) &&
    isNonEmptyString(value['sessionId']) &&
    isNonEmptyString(value['avatarId']) &&
    isLifecycleStatus(value['status']) &&
    isString(value['startedAt']) &&
    isString(value['lastActivityAt']) &&
    isOptionalString(value['endedAt'])
  )
}

function isAvatarSummary(value: unknown): value is AvatarSummary {
  if (!isRecord(value)) return false
  return [
    isNonEmptyString(value['avatarId']) && isNonEmptyString(value['scenarioId']),
    isString(value['name']),
    isAvatarStatus(value['status']),
    isString(value['personaPrompt']),
    hasOptionalStringProperty(value, 'tone'),
    hasOptionalStringProperty(value, 'description'),
    hasOptionalStringArrayProperty(value, 'adjustments'),
    isLlmOverride(value['llmOverride']),
    isComputedTraits(value['computedTraits']),
    isRecord(value['config']),
    hasRequiredStrings(value, ['createdAt', 'updatedAt']),
  ].every(Boolean)
}

function isAvatarStatus(value: unknown): boolean {
  return value === 'draft' || value === 'active' || value === 'archived'
}

function isLlmOverride(value: unknown): boolean {
  return (
    value === undefined ||
    (isRecord(value) &&
      hasOptionalStringProperty(value, 'provider') &&
      hasOptionalStringProperty(value, 'model'))
  )
}

function isComputedTraits(value: unknown): boolean {
  if (value === null) return true
  if (!isRecord(value)) return false
  return [
    'identity',
    'personality',
    'speakingStyle',
    'background',
    'timeline',
    'currentSituation',
    'behaviouralRules',
  ].every((key) => isStringArray(value[key]))
}

function isAvatarMessageMetadata(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmptyString(value['model']) &&
    isNonNegativeFiniteNumber(value['latencyMs']) &&
    isNonNegativeFiniteNumber(value['inputTokens']) &&
    isNonNegativeFiniteNumber(value['outputTokens']) &&
    (value['totalTokens'] === undefined || isNonNegativeFiniteNumber(value['totalTokens'])) &&
    (value['costUsd'] === undefined || isNonNegativeFiniteNumber(value['costUsd'])) &&
    isOptionalString(value['triggerSource'])
  )
}

function isMessage(value: unknown, role: Message['role']): value is Message {
  return (
    isRecord(value) &&
    isNonEmptyString(value['messageId']) &&
    isNonEmptyString(value['conversationId']) &&
    value['role'] === role &&
    isString(value['content']) &&
    isString(value['createdAt'])
  )
}

function isSendMessageResponse(value: unknown): value is SendMessageApiResponse {
  if (!isRecord(value)) return false
  const avatarMessage = value['avatarMessage']
  return (
    isSessionSummary(value['session']) &&
    isConversationSummary(value['conversation']) &&
    isMessage(value['userMessage'], 'user') &&
    isMessage(avatarMessage, 'avatar') &&
    isRecord(avatarMessage) &&
    isAvatarMessageMetadata(avatarMessage['metadata']) &&
    isDebugMetrics(value['debug'])
  )
}

function isDebugMetrics(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasRequiredStrings(value, ['requestId', 'model']) &&
    isNonNegativeFiniteNumber(value['latencyMs']) &&
    isNonNegativeFiniteNumber(value['inputTokens']) &&
    isNonNegativeFiniteNumber(value['outputTokens'])
  )
}

function isStartSessionResponse(value: unknown): value is StartSessionResponse {
  return isRecord(value) && isSessionSummary(value['session'])
}

function isListScenarioAvatarsResponse(value: unknown): value is ListScenarioAvatarsResponse {
  return (
    isRecord(value) && Array.isArray(value['avatars']) && value['avatars'].every(isAvatarSummary)
  )
}

function isStartConversationResponse(value: unknown): value is StartConversationResponse {
  return isRecord(value) && isConversationSummary(value['conversation'])
}

function isApiResponseError(value: unknown): value is ApiResponseError {
  return (
    isRecord(value) && typeof value['code'] === 'string' && typeof value['message'] === 'string'
  )
}

function isApiResponseEnvelope(value: unknown): value is ApiResponse<unknown> {
  if (!isRecord(value) || !('data' in value) || !('error' in value)) return false

  if (value['error'] === null) return value['data'] !== null
  return value['data'] === null && isApiResponseError(value['error'])
}

function safeApiMessage(error: ApiResponseError): string {
  return error.message.length > 0 ? error.message : 'Core API request failed.'
}

type RequestState = { timedOut: boolean }

function createError(
  path: string,
  status: number | null,
  code: string,
  message: string,
  kind: CoreApiErrorKind,
  phase?: EvaluationPhase,
): CoreApiError {
  return new CoreApiError({
    status,
    code,
    message,
    path,
    kind,
    ...(phase !== undefined ? { phase } : {}),
  })
}

function isSignalAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted ?? false
}

async function fetchResponse(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  path: string,
  state: RequestState,
  signal: AbortSignal | undefined,
  phase: EvaluationPhase,
): Promise<Response> {
  try {
    return await fetchImpl(url, init)
  } catch {
    if (state.timedOut) {
      throw createError(
        path,
        null,
        'TIMEOUT',
        'Core API request timed out.',
        'transport_error',
        phase,
      )
    }
    if (isSignalAborted(signal)) {
      throw createError(
        path,
        null,
        'ABORTED',
        'Core API request was aborted.',
        'transport_error',
        phase,
      )
    }
    throw createError(
      path,
      null,
      'NETWORK_ERROR',
      'Core API request failed.',
      'transport_error',
      phase,
    )
  }
}

async function decodeResponse<T>(
  response: Response,
  path: string,
  phase: EvaluationPhase,
  validate: (value: unknown) => value is T,
): Promise<T> {
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw createError(
      path,
      response.status,
      'INVALID_RESPONSE',
      'Core API returned invalid JSON.',
      'contract_error',
      phase,
    )
  }

  if (!isApiResponseEnvelope(payload)) {
    throw createError(
      path,
      response.status,
      'INVALID_RESPONSE',
      'Core API returned an invalid response envelope.',
      'contract_error',
      phase,
    )
  }

  if (payload.error !== null) {
    throw createError(
      path,
      response.status,
      payload.error.code,
      safeApiMessage(payload.error),
      'api_error',
      phase,
    )
  }

  if (!response.ok) {
    throw createError(
      path,
      response.status,
      'INVALID_RESPONSE',
      'Core API returned an unsuccessful response.',
      'contract_error',
      phase,
    )
  }

  if (!validate(payload.data)) {
    throw createError(
      path,
      response.status,
      'INVALID_RESPONSE',
      'Core API returned an invalid response body.',
      'contract_error',
      phase,
    )
  }

  return payload.data
}

export class CoreApiClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly timeoutMs: number
  private readonly fetchImpl: FetchLike

  constructor(options: CoreApiClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl)
    this.apiKey = options.apiKey
    this.timeoutMs = options.timeoutMs
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
  }

  async createSession(
    input: StartSessionRequest,
    options?: CoreApiRequestOptions,
  ): Promise<StartSessionResponse> {
    return this.request(
      'POST',
      '/v1/sessions',
      input,
      isStartSessionResponse,
      'session_bootstrap',
      options,
    )
  }

  async listScenarioAvatars(
    scenarioId: string,
    options?: CoreApiRequestOptions,
  ): Promise<ListScenarioAvatarsResponse> {
    return this.request(
      'GET',
      `/v1/scenarios/${encodeURIComponent(scenarioId)}/avatars`,
      undefined,
      isListScenarioAvatarsResponse,
      'avatar_resolution',
      options,
    )
  }

  async startConversation(
    sessionId: string,
    input: StartConversationRequest,
    options?: CoreApiRequestOptions,
  ): Promise<StartConversationResponse> {
    return this.request(
      'POST',
      `/v1/sessions/${encodeURIComponent(sessionId)}/conversations`,
      input,
      isStartConversationResponse,
      'conversation_bootstrap',
      options,
    )
  }

  async sendMessage(
    conversationId: string,
    content: string,
    options?: CoreApiRequestOptions,
    model?: ModelSelectionOverride,
  ): Promise<SendMessageApiResponse> {
    return this.request(
      'POST',
      `/v1/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        message: { content },
        ...(model === undefined ? {} : { model }),
      },
      isSendMessageResponse,
      'avatar_message',
      options,
    )
  }

  private async request<T>(
    method: HttpMethod,
    path: string,
    body: unknown,
    validate: (value: unknown) => value is T,
    phase: EvaluationPhase,
    options?: CoreApiRequestOptions,
  ): Promise<T> {
    const normalizedPath = normalizePath(path)
    const controller = new AbortController()
    if (isSignalAborted(options?.signal)) {
      throw createError(
        normalizedPath,
        null,
        'ABORTED',
        'Core API request was aborted.',
        'transport_error',
        phase,
      )
    }
    const state: RequestState = { timedOut: false }
    const onAbort = (): void => {
      controller.abort()
    }
    options?.signal?.addEventListener('abort', onAbort, { once: true })
    const timeout = setTimeout(() => {
      state.timedOut = true
      controller.abort()
    }, this.timeoutMs)

    try {
      const response = await fetchResponse(
        this.fetchImpl,
        `${this.baseUrl}${normalizedPath}`,
        {
          method,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
          },
          signal: controller.signal,
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        },
        normalizedPath,
        state,
        options?.signal,
        phase,
      )
      return await decodeResponse(response, normalizedPath, phase, validate)
    } finally {
      clearTimeout(timeout)
      options?.signal?.removeEventListener('abort', onAbort)
    }
  }
}

import type {
  ApiError,
  ApiResponse,
  ListScenarioAvatarsResponse,
  SendMessageApiResponse,
  StartConversationRequest,
  StartConversationResponse,
  StartSessionRequest,
  StartSessionResponse,
} from '@gami/shared'

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

  constructor(options: {
    status: number | null
    code: string
    message: string
    path: string
    kind: CoreApiErrorKind
  }) {
    const safeMessage = boundSafeMessage(options.message)
    super(safeMessage)
    this.name = 'CoreApiError'
    this.status = options.status
    this.code = options.code
    this.path = options.path
    this.kind = options.kind
    this.safeMessage = safeMessage
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
): CoreApiError {
  return new CoreApiError({ status, code, message, path, kind })
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
): Promise<Response> {
  try {
    return await fetchImpl(url, init)
  } catch {
    if (state.timedOut) {
      throw createError(path, null, 'TIMEOUT', 'Core API request timed out.', 'transport_error')
    }
    if (isSignalAborted(signal)) {
      throw createError(path, null, 'ABORTED', 'Core API request was aborted.', 'transport_error')
    }
    throw createError(path, null, 'NETWORK_ERROR', 'Core API request failed.', 'transport_error')
  }
}

async function decodeResponse<T>(response: Response, path: string): Promise<T> {
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
    )
  }

  if (!isApiResponseEnvelope(payload)) {
    throw createError(
      path,
      response.status,
      'INVALID_RESPONSE',
      'Core API returned an invalid response envelope.',
      'contract_error',
    )
  }

  if (payload.error !== null) {
    throw createError(
      path,
      response.status,
      payload.error.code,
      safeApiMessage(payload.error),
      'api_error',
    )
  }

  if (!response.ok) {
    throw createError(
      path,
      response.status,
      'INVALID_RESPONSE',
      'Core API returned an unsuccessful response.',
      'contract_error',
    )
  }

  return payload.data as T
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
    return this.request<StartSessionResponse>('POST', '/v1/sessions', input, options)
  }

  async listScenarioAvatars(
    scenarioId: string,
    options?: CoreApiRequestOptions,
  ): Promise<ListScenarioAvatarsResponse> {
    return this.request<ListScenarioAvatarsResponse>(
      'GET',
      `/v1/scenarios/${encodeURIComponent(scenarioId)}/avatars`,
      undefined,
      options,
    )
  }

  async startConversation(
    sessionId: string,
    input: StartConversationRequest,
    options?: CoreApiRequestOptions,
  ): Promise<StartConversationResponse> {
    return this.request<StartConversationResponse>(
      'POST',
      `/v1/sessions/${encodeURIComponent(sessionId)}/conversations`,
      input,
      options,
    )
  }

  async sendMessage(
    conversationId: string,
    content: string,
    options?: CoreApiRequestOptions,
  ): Promise<SendMessageApiResponse> {
    return this.request<SendMessageApiResponse>(
      'POST',
      `/v1/conversations/${encodeURIComponent(conversationId)}/messages`,
      { message: { content } },
      options,
    )
  }

  private async request<T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
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
      )
      return await decodeResponse<T>(response, normalizedPath)
    } finally {
      clearTimeout(timeout)
      options?.signal?.removeEventListener('abort', onAbort)
    }
  }
}

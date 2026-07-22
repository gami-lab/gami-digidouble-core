import type {
  ConversationHistoryApiResponse,
  ConversationSummary,
  EndConversationApiResponse,
  EndConversationRequest,
  EndConversationResponse,
  GetHistoryResponse,
  MessageStreamEvent,
  SendMessageApiResponse,
  SendMessageRequest,
  StartConversationRequest,
  StartConversationResponse,
} from '@gami/shared'
import { processSseFrames } from '@gami/shared'
import { ApiError, webRequest } from './client'
import { apiKey, apiUrl } from '../env'

const normalizeApiUrl = (value: string): string => value.replace(/\/$/, '')

export type MessageStreamHandlers = {
  onEvent: (event: MessageStreamEvent) => void
}

export async function startConversation(
  sessionId: string,
  request: StartConversationRequest,
): Promise<ConversationSummary> {
  const payload = await webRequest<StartConversationResponse>(
    'POST',
    `/v1/sessions/${sessionId}/conversations`,
    request,
  )

  return payload.conversation
}

export async function sendMessage(
  conversationId: string,
  request: SendMessageRequest,
): Promise<SendMessageApiResponse> {
  return webRequest<SendMessageApiResponse>(
    'POST',
    `/v1/conversations/${conversationId}/messages`,
    request,
  )
}

export async function sendMessageStream(
  conversationId: string,
  request: SendMessageRequest,
  handlers: MessageStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const path = `/v1/conversations/${conversationId}/messages/stream`
  const response = await openMessageStream(path, request, signal)
  if (response === null) {
    return
  }
  const body = await getMessageStreamBody(response, path)

  try {
    const terminalEventSeen = await consumeMessageStream(
      body,
      (event) => {
        handlers.onEvent(event)
      },
      signal,
    )

    if (signal?.aborted === true) {
      return
    }
    if (!terminalEventSeen) {
      throw new ApiError('NETWORK_ERROR', 'Message stream ended before completion')
    }
  } catch (error) {
    if (isAbortError(error) && signal?.aborted === true) {
      return
    }
    throw error instanceof Error
      ? error
      : new ApiError('NETWORK_ERROR', 'Message stream consumption failed')
  }
}

async function getMessageStreamBody(
  response: Response,
  path: string,
): Promise<ReadableStream<Uint8Array>> {
  if (!response.ok) {
    throw await readStreamApiError(response, path)
  }
  if (response.body === null) {
    throw new ApiError('NETWORK_ERROR', `Missing message stream body for ${path}`)
  }
  return response.body
}

export async function getConversationHistory(conversationId: string): Promise<GetHistoryResponse> {
  return webRequest<ConversationHistoryApiResponse>(
    'GET',
    `/v1/conversations/${conversationId}/history`,
  )
}

export async function endConversation(
  sessionId: string,
  conversationId: string,
  reason?: EndConversationRequest['reason'],
): Promise<EndConversationResponse> {
  const body: EndConversationRequest = reason !== undefined ? { reason } : {}
  return webRequest<EndConversationApiResponse>(
    'POST',
    `/v1/sessions/${sessionId}/conversations/${conversationId}/end`,
    body,
  )
}

async function consumeMessageStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: MessageStreamEvent) => void,
  signal?: AbortSignal,
): Promise<boolean> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let terminalEventSeen = false
  let readerCancelled = false
  const cancelReader = (): void => {
    if (readerCancelled) return
    readerCancelled = true
    void reader.cancel().catch(() => undefined)
  }
  const onAbort = (): void => {
    cancelReader()
  }
  signal?.addEventListener('abort', onAbort, { once: true })

  try {
    while (signal?.aborted !== true) {
      const chunk = await reader.read()
      if (chunk.done) {
        return terminalEventSeen
      }

      buffer += decoder.decode(chunk.value, { stream: true })
      buffer = processSseFrames(buffer, (event) => {
        const streamEvent = event as MessageStreamEvent
        onEvent(streamEvent)
        terminalEventSeen = isTerminalMessageStreamEvent(streamEvent) || terminalEventSeen
      })
    }
    return terminalEventSeen
  } finally {
    signal?.removeEventListener('abort', onAbort)
    cancelReader()
    reader.releaseLock()
  }
}

async function openMessageStream(
  path: string,
  request: SendMessageRequest,
  signal?: AbortSignal,
): Promise<Response | null> {
  try {
    return await fetch(`${normalizeApiUrl(apiUrl)}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(request),
      ...(signal !== undefined ? { signal } : {}),
    })
  } catch (error) {
    if (isAbortError(error) && signal?.aborted === true) {
      return null
    }
    throw new ApiError('NETWORK_ERROR', `Network request failed: POST ${path}`)
  }
}

async function readStreamApiError(response: Response, path: string): Promise<ApiError> {
  try {
    const payload: unknown = await response.json()
    if (isObjectRecord(payload) && isObjectRecord(payload.error)) {
      const code = payload.error.code
      const message = payload.error.message
      if (typeof code === 'string' && typeof message === 'string') {
        return new ApiError(code, message, payload.error.details)
      }
    }
  } catch {
    // Fall through to the status-based error below.
  }

  return new ApiError(
    'NETWORK_ERROR',
    `Request failed with status ${String(response.status)}: ${path}`,
  )
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isTerminalMessageStreamEvent(event: MessageStreamEvent): boolean {
  return (
    event.type === 'conversation.message.completed' ||
    event.type === 'conversation.message.interrupted' ||
    event.type === 'conversation.message.error'
  )
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

import type {
  AudioDeliveryMetadata,
  AudioDeliveryRequest,
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
import {
  isAudioDeliveryMetadata,
  normalizeApiUrl,
  parseMessageStreamEvent,
  processSseFrames,
} from '@gami/shared'
import { ApiError, webBinaryRequest, webRequest } from './client'
import { apiKey, apiUrl } from '../env'
import { isTerminalMessageStreamEvent } from '../chat/message-stream-events'

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

/** Reply audio as Core streams it; `body` delivers chunks as soon as they are synthesized. */
export type MessageAudioDelivery = Readonly<{
  body: ReadableStream<Uint8Array>
  metadata: AudioDeliveryMetadata
}>

export async function requestMessageAudio(
  conversationId: string,
  messageId: string,
  request: AudioDeliveryRequest = {},
  signal?: AbortSignal,
): Promise<MessageAudioDelivery> {
  const path = `/v1/conversations/${conversationId}/messages/${messageId}/audio`
  const response = await webBinaryRequest('POST', path, request, signal)
  const metadata = readAudioDeliveryMetadata(response, path)
  if (metadata.messageId !== messageId) {
    throw new ApiError('NETWORK_ERROR', `Audio response message identity mismatch from ${path}`)
  }
  if (response.body === null) {
    throw new ApiError('NETWORK_ERROR', `Invalid audio response body from ${path}`)
  }

  return { body: response.body, metadata }
}

export async function sendMessageStream(
  conversationId: string,
  request: SendMessageRequest,
  handlers: MessageStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  await streamMessageEvents(
    `/v1/conversations/${conversationId}/messages/stream`,
    { 'Content-Type': 'application/json' },
    JSON.stringify(request),
    handlers,
    signal,
  )
}

export type VoiceMessageUpload = Readonly<{
  audio: Blob
  /** Unique per recording; Core rejects duplicates of the same utterance. */
  utteranceId: string
  durationMs?: number
}>

/** Sends one recorded utterance; the reply streams back with the same events as text. */
export async function sendVoiceMessageStream(
  conversationId: string,
  upload: VoiceMessageUpload,
  handlers: MessageStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  await streamMessageEvents(
    `/v1/conversations/${conversationId}/voice-messages/stream`,
    {
      'Content-Type': upload.audio.type,
      'x-utterance-id': upload.utteranceId,
      ...(upload.durationMs === undefined
        ? {}
        : { 'x-audio-duration-ms': String(Math.max(1, Math.round(upload.durationMs))) }),
    },
    upload.audio,
    handlers,
    signal,
  )
}

async function streamMessageEvents(
  path: string,
  headers: Record<string, string>,
  requestBody: BodyInit,
  handlers: MessageStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const response = await openMessageStream(path, headers, requestBody, signal)
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
        const streamEvent = parseMessageStreamEvent(event)
        if (streamEvent === null) {
          throw new ApiError('NETWORK_ERROR', 'Invalid message stream event')
        }
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
  headers: Record<string, string>,
  body: BodyInit,
  signal?: AbortSignal,
): Promise<Response | null> {
  try {
    return await fetch(`${normalizeApiUrl(apiUrl)}${path}`, {
      method: 'POST',
      headers: { ...headers, 'x-api-key': apiKey },
      body,
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
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
  }

  return new ApiError(
    'NETWORK_ERROR',
    `Request failed with status ${String(response.status)}: ${path}`,
  )
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

function readAudioDeliveryMetadata(response: Response, path: string): AudioDeliveryMetadata {
  const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim()
  const requestId = response.headers.get('x-request-id')
  const messageId = response.headers.get('x-message-id')

  const candidate: unknown = { requestId, messageId, format: contentType }
  if (!isAudioDeliveryMetadata(candidate)) {
    throw new ApiError('NETWORK_ERROR', `Invalid audio response metadata from ${path}`)
  }

  return candidate
}

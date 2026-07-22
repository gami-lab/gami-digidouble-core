import type { Message, SendMessageResponse } from './conversation-contract-types.js'

/**
 * Public message-stream events are owned by @gami/shared. The Core application
 * layer may define internal execution contracts, but it must map them to these
 * DTOs at the API boundary.
 */
export type MessageStreamEventBase = {
  requestId: string
  conversationId: string
}

export type MessageStreamStartedEvent = MessageStreamEventBase & {
  type: 'conversation.message.started'
  userMessage: Message
}

export type MessageStreamDeltaEvent = MessageStreamEventBase & {
  type: 'conversation.message.delta'
  sequence: number
  delta: string
}

export type MessageStreamCompletedEvent = MessageStreamEventBase & {
  type: 'conversation.message.completed'
  response: SendMessageResponse
}

export type MessageStreamInterruptedEvent = MessageStreamEventBase & {
  type: 'conversation.message.interrupted'
  reason: 'client_aborted' | 'provider_aborted'
}

export type MessageStreamErrorEvent = MessageStreamEventBase & {
  type: 'conversation.message.error'
  message: string
}

export type MessageStreamEvent =
  | MessageStreamStartedEvent
  | MessageStreamDeltaEvent
  | MessageStreamCompletedEvent
  | MessageStreamInterruptedEvent
  | MessageStreamErrorEvent

/**
 * Decode untrusted SSE JSON at the public client boundary. TypeScript types do
 * not validate payloads received from another process.
 */
export function parseMessageStreamEvent(value: unknown): MessageStreamEvent | null {
  return isMessageStreamEvent(value) ? value : null
}

// eslint-disable-next-line complexity
export function isMessageStreamEvent(value: unknown): value is MessageStreamEvent {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.requestId) ||
    !isNonEmptyString(value.conversationId)
  ) {
    return false
  }

  switch (value.type) {
    case 'conversation.message.started':
      return isMessage(value.userMessage)
    case 'conversation.message.delta':
      return (
        typeof value.sequence === 'number' &&
        Number.isInteger(value.sequence) &&
        value.sequence >= 0 &&
        typeof value.delta === 'string'
      )
    case 'conversation.message.completed':
      return isSendMessageResponse(value.response)
    case 'conversation.message.interrupted':
      return value.reason === 'client_aborted' || value.reason === 'provider_aborted'
    case 'conversation.message.error':
      return typeof value.message === 'string' && value.message.length > 0
    default:
      return false
  }
}

// eslint-disable-next-line complexity
function isSendMessageResponse(value: unknown): value is SendMessageResponse {
  if (!isRecord(value)) return false
  return (
    isConversationSummary(value.conversation) &&
    isSessionSummary(value.session) &&
    isMessage(value.userMessage) &&
    isAvatarMessage(value.avatarMessage) &&
    isRecord(value.debug) &&
    isNonEmptyString(value.debug.requestId) &&
    isNonEmptyString(value.debug.model) &&
    isNonNegativeNumber(value.debug.latencyMs) &&
    isNonNegativeNumber(value.debug.inputTokens) &&
    isNonNegativeNumber(value.debug.outputTokens)
  )
}

function isMessage(value: unknown): value is Message {
  if (!isRecord(value)) return false
  if (
    !isNonEmptyString(value.messageId) ||
    !isNonEmptyString(value.conversationId) ||
    typeof value.content !== 'string' ||
    !isNonEmptyString(value.createdAt) ||
    (value.role !== 'user' && value.role !== 'avatar' && value.role !== 'system')
  ) {
    return false
  }
  return value.metadata === undefined || isMessageMetadata(value.metadata)
}

function isAvatarMessage(value: unknown): boolean {
  if (!isMessage(value) || value.role !== 'avatar' || !isRecord(value.metadata)) return false
  return (
    isNonEmptyString(value.metadata.model) &&
    isNonNegativeNumber(value.metadata.latencyMs) &&
    isNonNegativeNumber(value.metadata.inputTokens) &&
    isNonNegativeNumber(value.metadata.outputTokens)
  )
}

// eslint-disable-next-line complexity
function isMessageMetadata(value: unknown): boolean {
  if (!isRecord(value)) return false
  return (
    (value.model === undefined || typeof value.model === 'string') &&
    (value.latencyMs === undefined || isNonNegativeNumber(value.latencyMs)) &&
    (value.inputTokens === undefined || isNonNegativeNumber(value.inputTokens)) &&
    (value.outputTokens === undefined || isNonNegativeNumber(value.outputTokens)) &&
    (value.totalTokens === undefined || isNonNegativeNumber(value.totalTokens)) &&
    (value.costUsd === undefined || isNonNegativeNumber(value.costUsd)) &&
    (value.triggerSource === undefined || typeof value.triggerSource === 'string')
  )
}

function isConversationSummary(value: unknown): boolean {
  if (!isRecord(value)) return false
  return (
    isNonEmptyString(value.conversationId) &&
    isNonEmptyString(value.sessionId) &&
    isNonEmptyString(value.avatarId) &&
    isLifecycleStatus(value.status) &&
    isNonEmptyString(value.startedAt) &&
    isNonEmptyString(value.lastActivityAt) &&
    (value.endedAt === undefined || typeof value.endedAt === 'string')
  )
}

// eslint-disable-next-line complexity
function isSessionSummary(value: unknown): boolean {
  if (!isRecord(value)) return false
  return (
    isNonEmptyString(value.sessionId) &&
    isNonEmptyString(value.userId) &&
    isNonEmptyString(value.scenarioId) &&
    isLifecycleStatus(value.status) &&
    isNonEmptyString(value.startedAt) &&
    isNonEmptyString(value.lastActivityAt) &&
    (value.activeAvatarId === undefined || typeof value.activeAvatarId === 'string') &&
    (value.unlockedAvatarIds === undefined ||
      (Array.isArray(value.unlockedAvatarIds) &&
        value.unlockedAvatarIds.every((avatarId) => typeof avatarId === 'string'))) &&
    (value.endedAt === undefined || typeof value.endedAt === 'string')
  )
}

function isLifecycleStatus(value: unknown): boolean {
  return value === 'active' || value === 'closed' || value === 'archived'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

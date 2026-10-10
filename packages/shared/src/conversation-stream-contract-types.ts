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

export function isMessageStreamEvent(value: unknown): value is MessageStreamEvent {
  if (!isMessageStreamEventBase(value)) return false
  return isMessageStreamEventBody(value)
}

function isMessageStreamEventBody(value: Record<string, unknown>): boolean {
  switch (value.type) {
    case 'conversation.message.started':
      return isMessage(value.userMessage)
    case 'conversation.message.delta':
      return isMessageDelta(value)
    case 'conversation.message.completed':
      return isSendMessageResponse(value.response)
    case 'conversation.message.interrupted':
      return isMessageInterruption(value.reason)
    case 'conversation.message.error':
      return isMessageError(value.message)
    default:
      return false
  }
}

function isMessageDelta(value: Record<string, unknown>): boolean {
  return (
    typeof value.sequence === 'number' &&
    Number.isInteger(value.sequence) &&
    value.sequence >= 0 &&
    typeof value.delta === 'string'
  )
}

function isMessageInterruption(value: unknown): boolean {
  return value === 'client_aborted' || value === 'provider_aborted'
}

function isMessageError(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0
}

function isSendMessageResponse(value: unknown): value is SendMessageResponse {
  if (!isRecord(value)) return false
  return (
    isConversationSummary(value.conversation) &&
    isSessionSummary(value.session) &&
    isMessage(value.userMessage) &&
    isAvatarMessage(value.avatarMessage) &&
    isMessageDebug(value.debug)
  )
}

function isMessageStreamEventBase(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) && isNonEmptyString(value.requestId) && isNonEmptyString(value.conversationId)
  )
}

function isMessageDebug(value: unknown): boolean {
  if (!isRecord(value)) return false
  return [
    isNonEmptyString(value.requestId),
    isNonEmptyString(value.model),
    isNonNegativeNumber(value.latencyMs),
    isNonNegativeNumber(value.inputTokens),
    isNonNegativeNumber(value.outputTokens),
  ].every(Boolean)
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

function isMessageMetadata(value: unknown): boolean {
  if (!isRecord(value)) return false
  return [
    (value.model === undefined || typeof value.model === 'string') &&
      (value.latencyMs === undefined || isNonNegativeNumber(value.latencyMs)),
    value.inputTokens === undefined || isNonNegativeNumber(value.inputTokens),
    value.outputTokens === undefined || isNonNegativeNumber(value.outputTokens),
    value.totalTokens === undefined || isNonNegativeNumber(value.totalTokens),
    value.costUsd === undefined || isNonNegativeNumber(value.costUsd),
    value.triggerSource === undefined || typeof value.triggerSource === 'string',
  ].every(Boolean)
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

function isSessionSummary(value: unknown): boolean {
  if (!isRecord(value)) return false
  return (
    isNonEmptyString(value.sessionId) &&
    isNonEmptyString(value.userId) &&
    isNonEmptyString(value.scenarioId) &&
    isLifecycleStatus(value.status) &&
    isNonEmptyString(value.startedAt) &&
    isNonEmptyString(value.lastActivityAt) &&
    isOptionalString(value.activeAvatarId) &&
    isOptionalStringArray(value.unlockedAvatarIds) &&
    isOptionalString(value.endedAt)
  )
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string'
}

function isOptionalStringArray(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) && value.every((entry) => typeof entry === 'string'))
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

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

import type { Message } from '../../../domain/conversation/session.types.js'
import type { SendMessageOutput } from './send-message.types.js'

export type StreamingSendMessageEvent =
  | {
      type: 'started'
      requestId: string
      conversationId: string
      userMessage: Message
    }
  | {
      type: 'delta'
      requestId: string
      conversationId: string
      sequence: number
      delta: string
    }
  | {
      type: 'completed'
      requestId: string
      conversationId: string
      output: SendMessageOutput
    }
  | {
      type: 'interrupted'
      requestId: string
      conversationId: string
      reason: 'client_aborted' | 'provider_aborted'
    }

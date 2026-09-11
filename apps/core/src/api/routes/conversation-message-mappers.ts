import type {
  Message as SharedMessage,
  MessageStreamEvent,
  SendMessageResponse,
} from '@gami/shared'
import type { StreamingSendMessageEvent } from '../../application/use-cases/send-message/streaming-send-message.types.js'
import type { SendMessageOutput } from '../../application/use-cases/send-message/send-message.types.js'
import type { Message as DomainMessage } from '../../domain/conversation/session.types.js'

export function mapSendMessageResponse(output: SendMessageOutput): SendMessageResponse {
  return {
    conversation: {
      conversationId: output.conversation.conversationId,
      sessionId: output.conversation.sessionId,
      avatarId: output.conversation.avatarId,
      status: output.conversation.status,
      startedAt: output.conversation.startedAt,
      lastActivityAt: output.conversation.lastActivityAt,
      ...(output.conversation.endedAt !== undefined
        ? { endedAt: output.conversation.endedAt }
        : {}),
    },
    session: {
      sessionId: output.session.sessionId,
      userId: output.session.userId,
      scenarioId: output.session.scenarioId,
      ...(output.session.activeAvatarId !== undefined
        ? { activeAvatarId: output.session.activeAvatarId }
        : {}),
      ...(output.session.unlockedAvatarIds !== undefined
        ? { unlockedAvatarIds: output.session.unlockedAvatarIds }
        : {}),
      ...(output.session.avatarOptions !== undefined
        ? { avatarOptions: output.session.avatarOptions }
        : {}),
      status: output.session.status,
      startedAt: output.session.startedAt,
      lastActivityAt: output.session.lastActivityAt,
    },
    userMessage: {
      messageId: output.userMessage.messageId,
      conversationId: output.conversationId,
      role: 'user',
      content: output.userMessage.content,
      createdAt: output.userMessage.createdAt,
    },
    avatarMessage: {
      messageId: output.avatarMessage.messageId,
      conversationId: output.conversationId,
      role: 'avatar',
      content: output.avatarMessage.content,
      createdAt: output.avatarMessage.createdAt,
      metadata: {
        model: output.avatarMessage.model,
        latencyMs: output.avatarMessage.latencyMs,
        inputTokens: output.avatarMessage.inputTokens,
        outputTokens: output.avatarMessage.outputTokens,
        totalTokens: output.avatarMessage.inputTokens + output.avatarMessage.outputTokens,
      },
    },
    debug: {
      requestId: output.requestId,
      model: output.avatarMessage.model,
      latencyMs: output.avatarMessage.latencyMs,
      inputTokens: output.avatarMessage.inputTokens,
      outputTokens: output.avatarMessage.outputTokens,
    },
  }
}

export function mapStreamingEvent(event: StreamingSendMessageEvent): MessageStreamEvent {
  switch (event.type) {
    case 'started':
      return {
        type: 'conversation.message.started',
        requestId: event.requestId,
        conversationId: event.conversationId,
        userMessage: mapMessage(event.userMessage),
      }
    case 'delta':
      return {
        type: 'conversation.message.delta',
        requestId: event.requestId,
        conversationId: event.conversationId,
        sequence: event.sequence,
        delta: event.delta,
      }
    case 'completed':
      return {
        type: 'conversation.message.completed',
        requestId: event.requestId,
        conversationId: event.conversationId,
        response: mapSendMessageResponse(event.output),
      }
    case 'interrupted':
      return {
        type: 'conversation.message.interrupted',
        requestId: event.requestId,
        conversationId: event.conversationId,
        reason: event.reason,
      }
  }
}

export function writeMessageStreamFrame(
  response: NodeJS.WritableStream & { write: (chunk: string) => boolean },
  event: MessageStreamEvent,
): void {
  const id = getMessageStreamEventId(event)
  response.write(`event: conversation_message\nid: ${id}\ndata: ${JSON.stringify(event)}\n\n`)
}

function mapMessage(message: DomainMessage): SharedMessage {
  return message
}

function getMessageStreamEventId(event: MessageStreamEvent): string {
  if (event.type === 'conversation.message.delta') {
    return `${event.requestId}:${String(event.sequence)}`
  }
  return `${event.requestId}:${event.type}`
}

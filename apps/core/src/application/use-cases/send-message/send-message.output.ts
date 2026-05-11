import type { SendMessageOutput } from './send-message.types.js'
import type { Conversation, Message, Session } from '../../../domain/conversation/session.types.js'

export function buildSendMessageOutput(args: {
  requestId: string
  conversation: Conversation
  updatedSession: Session
  userMessage: Message
  avatarMessage: Message
  response: { model: string; inputTokens: number; outputTokens: number; latencyMs: number }
  now: string
}): SendMessageOutput {
  const { requestId, conversation, updatedSession, userMessage, avatarMessage, response, now } =
    args
  return {
    requestId,
    conversationId: conversation.conversationId,
    conversation: {
      conversationId: conversation.conversationId,
      sessionId: conversation.sessionId,
      avatarId: conversation.avatarId,
      status: conversation.status,
      startedAt: conversation.startedAt,
      lastActivityAt: now,
      ...(conversation.endedAt !== undefined ? { endedAt: conversation.endedAt } : {}),
    },
    session: {
      sessionId: updatedSession.sessionId,
      userId: updatedSession.userId,
      scenarioId: updatedSession.scenarioId,
      ...(updatedSession.activeAvatarId !== undefined
        ? { activeAvatarId: updatedSession.activeAvatarId }
        : {}),
      ...(updatedSession.unlockedAvatarIds !== undefined
        ? { unlockedAvatarIds: updatedSession.unlockedAvatarIds }
        : {}),
      status: updatedSession.status,
      startedAt: updatedSession.startedAt,
      lastActivityAt: now,
    },
    userMessage: {
      messageId: userMessage.messageId,
      content: userMessage.content,
      createdAt: userMessage.createdAt,
    },
    avatarMessage: {
      messageId: avatarMessage.messageId,
      content: avatarMessage.content,
      createdAt: avatarMessage.createdAt,
      model: response.model,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      latencyMs: response.latencyMs,
    },
  }
}

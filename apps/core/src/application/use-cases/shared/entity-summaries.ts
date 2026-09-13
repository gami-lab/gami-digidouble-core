import type { ConversationSummary, Message as SharedMessage, SessionSummary } from '@gami/shared'
import type { Conversation, Message, Session } from '../../../domain/conversation/session.types.js'

/**
 * Boundary mappers for the public projections of conversation entities.
 *
 * Domain entities intentionally remain separate from shared HTTP DTOs. These
 * functions are the single application-layer mapping point between them.
 */
export function toSessionSummary(session: Session): SessionSummary {
  return {
    sessionId: session.sessionId,
    userId: session.userId,
    scenarioId: session.scenarioId,
    ...(session.activeAvatarId !== undefined ? { activeAvatarId: session.activeAvatarId } : {}),
    ...(session.unlockedAvatarIds !== undefined
      ? { unlockedAvatarIds: [...session.unlockedAvatarIds] }
      : {}),
    ...(session.avatarOptions !== undefined ? { avatarOptions: session.avatarOptions } : {}),
    status: session.status,
    startedAt: session.startedAt,
    lastActivityAt: session.lastActivityAt,
    ...(session.endedAt !== undefined ? { endedAt: session.endedAt } : {}),
  }
}

export function toConversationSummary(conversation: Conversation): ConversationSummary {
  return {
    conversationId: conversation.conversationId,
    sessionId: conversation.sessionId,
    avatarId: conversation.avatarId,
    status: conversation.status,
    startedAt: conversation.startedAt,
    lastActivityAt: conversation.lastActivityAt,
    ...(conversation.endedAt !== undefined ? { endedAt: conversation.endedAt } : {}),
  }
}

export function toMessage(message: Message): SharedMessage {
  return {
    messageId: message.messageId,
    conversationId: message.conversationId,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    ...(message.metadata !== undefined ? { metadata: { ...message.metadata } } : {}),
  }
}

import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { Conversation } from '../../../domain/conversation/session.types.js'
import { DomainError } from '../../../domain/errors.js'
import type {
  AvatarTransitionRecord,
  GetAvatarTransitionsInput,
  GetAvatarTransitionsOutput,
} from './get-avatar-transitions.types.js'

export class GetAvatarTransitionsUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly conversationRepository: IConversationRepository,
  ) {}

  async execute(input: GetAvatarTransitionsInput): Promise<GetAvatarTransitionsOutput> {
    const session = await this.sessionRepository.findById(input.sessionId)
    if (session === null) {
      throw new DomainError('NOT_FOUND', `Session ${input.sessionId} was not found.`)
    }

    const conversations = (await this.conversationRepository.listBySessionId(input.sessionId))
      .slice()
      .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))
    const conversationById = new Map(
      conversations.map((conversation) => [conversation.conversationId, conversation]),
    )

    return {
      sessionId: input.sessionId,
      transitions: conversations.map((conversation) =>
        this.toTransitionRecord(conversation, conversationById),
      ),
    }
  }

  private toTransitionRecord(
    conversation: Conversation,
    conversationById: Map<string, Conversation>,
  ): AvatarTransitionRecord {
    if (conversation.handoffFromConversationId === undefined) {
      return {
        toConversationId: conversation.conversationId,
        toAvatarId: conversation.avatarId,
        fromConversationId: null,
        fromAvatarId: null,
        reason: 'session_start',
        startedBy: conversation.startedBy ?? null,
        transitionedAt: conversation.startedAt,
      }
    }

    const fromConversation = conversationById.get(conversation.handoffFromConversationId)

    return {
      toConversationId: conversation.conversationId,
      toAvatarId: conversation.avatarId,
      fromConversationId: conversation.handoffFromConversationId,
      fromAvatarId: fromConversation?.avatarId ?? null,
      reason: conversation.reason ?? null,
      startedBy: conversation.startedBy ?? null,
      transitionedAt: conversation.startedAt,
    }
  }
}

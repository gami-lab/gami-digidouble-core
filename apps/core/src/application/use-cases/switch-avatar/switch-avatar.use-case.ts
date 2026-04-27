import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { Conversation, Session } from '../../../domain/conversation/session.types.js'
import { DomainError } from '../../../domain/errors.js'
import type { SwitchAvatarInput, SwitchAvatarOutput } from './switch-avatar.types.js'

export class SwitchAvatarUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly avatarRepository: IAvatarRepository,
    private readonly conversationRepository: IConversationRepository,
  ) {}

  async execute(input: SwitchAvatarInput): Promise<SwitchAvatarOutput> {
    const { sessionId, avatarId } = this.validateInput(input)
    const session = await this.loadActiveSession(sessionId)
    await this.ensureAvatarBelongsToScenario(avatarId, session.scenarioId)
    this.ensureAvatarIsUnlocked(session, avatarId)

    const previousConversation = await this.conversationRepository.findActiveBySessionId(sessionId)
    const now = new Date().toISOString()

    await this.closePreviousConversation(previousConversation?.conversationId, now)

    const conversation = await this.conversationRepository.create({
      sessionId,
      avatarId,
      startedBy: 'user',
      reason: input.reason ?? 'manual_switch',
      ...(previousConversation !== null
        ? { handoffFromConversationId: previousConversation.conversationId }
        : {}),
    })

    await this.sessionRepository.update(sessionId, {
      activeAvatarId: avatarId,
      lastActivityAt: now,
    })

    const updatedSession = await this.sessionRepository.findById(sessionId)
    if (updatedSession === null) {
      throw new DomainError('NOT_FOUND', `Session ${sessionId} was not found.`)
    }

    return {
      session: this.toSessionSummary(updatedSession),
      conversation: this.toConversationSummary(conversation),
      previousConversationId: previousConversation?.conversationId ?? null,
    }
  }

  private ensureAvatarIsUnlocked(session: Session, avatarId: string): void {
    if (session.unlockedAvatarIds === undefined) return
    if (session.unlockedAvatarIds.includes(avatarId)) return

    throw new DomainError(
      'FORBIDDEN',
      `Avatar ${avatarId} is locked for session ${session.sessionId}.`,
    )
  }

  private validateInput(input: SwitchAvatarInput): { sessionId: string; avatarId: string } {
    const sessionId = input.sessionId.trim()
    const avatarId = input.avatarId.trim()

    if (sessionId.length === 0) {
      throw new DomainError('VALIDATION_ERROR', 'sessionId must be a non-empty string.')
    }
    if (avatarId.length === 0) {
      throw new DomainError('VALIDATION_ERROR', 'avatarId must be a non-empty string.')
    }

    return { sessionId, avatarId }
  }

  private async loadActiveSession(sessionId: string) {
    const session = await this.sessionRepository.findById(sessionId)
    if (session === null) {
      throw new DomainError('NOT_FOUND', `Session ${sessionId} was not found.`)
    }
    if (session.status !== 'active') {
      throw new DomainError('CONFLICT', 'Session is not active.')
    }
    return session
  }

  private async ensureAvatarBelongsToScenario(avatarId: string, scenarioId: string): Promise<void> {
    const avatar = await this.avatarRepository.findById(avatarId)
    if (avatar === null) {
      throw new DomainError('NOT_FOUND', `Avatar ${avatarId} was not found.`)
    }
    if (avatar.scenarioId !== scenarioId) {
      throw new DomainError('VALIDATION_ERROR', 'Avatar does not belong to the session scenario.')
    }
  }

  private async closePreviousConversation(
    conversationId: string | undefined,
    endedAt: string,
  ): Promise<void> {
    if (conversationId === undefined) return
    await this.conversationRepository.update(conversationId, {
      status: 'closed',
      endedAt,
    })
  }

  private toSessionSummary(session: Session) {
    return {
      sessionId: session.sessionId,
      userId: session.userId,
      scenarioId: session.scenarioId,
      status: session.status,
      startedAt: session.startedAt,
      lastActivityAt: session.lastActivityAt,
      ...(session.activeAvatarId !== undefined ? { activeAvatarId: session.activeAvatarId } : {}),
      ...(session.endedAt !== undefined ? { endedAt: session.endedAt } : {}),
    }
  }

  private toConversationSummary(conversation: Conversation) {
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
}

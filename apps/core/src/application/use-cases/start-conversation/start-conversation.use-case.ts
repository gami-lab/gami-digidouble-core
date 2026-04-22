import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type { StartConversationInput, StartConversationOutput } from './start-conversation.types.js'

export class StartConversationUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly avatarRepository: IAvatarRepository,
    private readonly conversationRepository: IConversationRepository,
  ) {}

  async execute(input: StartConversationInput): Promise<StartConversationOutput> {
    const sessionId = input.sessionId.trim()
    const avatarId = input.avatarId.trim()

    if (sessionId.length === 0) {
      throw new DomainError('VALIDATION_ERROR', 'sessionId must be a non-empty string.')
    }
    if (avatarId.length === 0) {
      throw new DomainError('VALIDATION_ERROR', 'avatarId must be a non-empty string.')
    }

    const session = await this.sessionRepository.findById(sessionId)
    if (session === null) {
      throw new DomainError('NOT_FOUND', `Session ${sessionId} was not found.`)
    }
    if (session.status !== 'active') {
      throw new DomainError('CONFLICT', `Session ${sessionId} is not active.`)
    }

    const avatar = await this.avatarRepository.findById(avatarId)
    if (avatar === null) {
      throw new DomainError('NOT_FOUND', `Avatar ${avatarId} was not found.`)
    }
    if (avatar.scenarioId !== session.scenarioId) {
      throw new DomainError(
        'VALIDATION_ERROR',
        `Avatar ${avatarId} does not belong to scenario ${session.scenarioId}.`,
      )
    }

    const conversation = await this.conversationRepository.create({
      sessionId,
      avatarId,
      startedBy: 'user',
    })

    await this.sessionRepository.update(sessionId, {
      activeAvatarId: avatarId,
      lastActivityAt: conversation.lastActivityAt,
    })

    return {
      conversation: {
        conversationId: conversation.conversationId,
        sessionId: conversation.sessionId,
        avatarId: conversation.avatarId,
        status: conversation.status,
        startedAt: conversation.startedAt,
        lastActivityAt: conversation.lastActivityAt,
        ...(conversation.endedAt !== undefined ? { endedAt: conversation.endedAt } : {}),
      },
    }
  }
}

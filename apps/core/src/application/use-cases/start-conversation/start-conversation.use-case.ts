import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { IConversationWorkingMemoryRepository } from '../../ports/IConversationWorkingMemoryRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type { StartConversationInput, StartConversationOutput } from './start-conversation.types.js'

export class StartConversationUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly avatarRepository: IAvatarRepository,
    private readonly conversationRepository: IConversationRepository,
    private readonly conversationWorkingMemoryRepository?: IConversationWorkingMemoryRepository,
    private readonly episodicMemoryService?: {
      hydrateForNewConversation(input: {
        conversationId: string
        sessionId: string
        userId: string
        avatarId: string
        scenarioId: string
        queryText?: string
      }): Promise<{
        summary: string
        unresolvedThreads: string[]
        candidateFacts: Array<{ category: string; key: string; value: string }>
      }>
    },
  ) {}

  async execute(input: StartConversationInput): Promise<StartConversationOutput> {
    const { sessionId, avatarId } = this.validateInput(input)
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
    if (session.unlockedAvatarIds !== undefined && !session.unlockedAvatarIds.includes(avatarId)) {
      throw new DomainError('FORBIDDEN', `Avatar ${avatarId} is locked for session ${sessionId}.`)
    }

    const conversation = await this.conversationRepository.create({
      sessionId,
      avatarId,
      startedBy: 'user',
    })
    const now = new Date().toISOString()

    await this.sessionRepository.update(sessionId, {
      activeAvatarId: avatarId,
      lastActivityAt: now,
    })

    await this.hydrateConversationMemory({
      conversationId: conversation.conversationId,
      sessionId,
      userId: session.userId,
      avatarId,
      scenarioId: session.scenarioId,
      ...(session.memorySummary !== undefined ? { queryText: session.memorySummary } : {}),
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

  private validateInput(input: StartConversationInput): { sessionId: string; avatarId: string } {
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

  private async hydrateConversationMemory(input: {
    conversationId: string
    sessionId: string
    userId: string
    avatarId: string
    scenarioId: string
    queryText?: string
  }): Promise<void> {
    if (
      this.episodicMemoryService === undefined ||
      this.conversationWorkingMemoryRepository === undefined
    ) {
      return
    }
    const hydration = await this.episodicMemoryService.hydrateForNewConversation(input)
    await this.conversationWorkingMemoryRepository.upsert({
      conversationId: input.conversationId,
      sessionId: input.sessionId,
      avatarId: input.avatarId,
      summary: hydration.summary,
      unresolvedThreads: hydration.unresolvedThreads,
      candidateFacts: hydration.candidateFacts,
    })
  }
}

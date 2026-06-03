import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { IConversationWorkingMemoryRepository } from '../../ports/IConversationWorkingMemoryRepository.js'
import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'
import type { IGmStateRepository } from '../../ports/IGmStateRepository.js'
import type { IMemoryMaintenancePort } from '../../ports/IMemoryMaintenancePort.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import { DomainError } from '../../../domain/errors.js'
import {
  hydrateConversationMemoryForNewConversation,
  type EpisodicMemoryHydrationService,
} from '../shared/hydrate-conversation-memory.js'
import type { StartConversationInput, StartConversationOutput } from './start-conversation.types.js'

type EpisodicMemoryService = {
  generateForClosedConversation(input: {
    conversationId: string
    sessionId: string
    userId: string
    avatarId: string
    scenarioId: string
  }): Promise<unknown>
} & EpisodicMemoryHydrationService

export class StartConversationUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly avatarRepository: IAvatarRepository,
    private readonly conversationRepository: IConversationRepository,
    private readonly conversationWorkingMemoryRepository?: IConversationWorkingMemoryRepository,
    private readonly episodicMemoryService?: EpisodicMemoryService,
    private readonly eventLogRepository?: IEventLogRepository,
    private readonly memoryMaintenance?: IMemoryMaintenancePort,
    private readonly gmStateRepository?: IGmStateRepository,
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

    // Close any existing active conversation and promote its working memory to long-term
    // before opening the new one, so history is never lost.
    const previousConversation = await this.conversationRepository.findActiveBySessionId(sessionId)
    const now = new Date().toISOString()
    if (previousConversation !== null) {
      await this.conversationRepository.update(previousConversation.conversationId, {
        status: 'closed',
        endedAt: now,
      })
      void this.runBackgroundClosePipeline({
        sessionId,
        conversationId: previousConversation.conversationId,
        userId: session.userId,
        avatarId: previousConversation.avatarId,
        scenarioId: session.scenarioId,
      })
    }

    const conversation = await this.conversationRepository.create({
      sessionId,
      avatarId,
      startedBy: 'user',
    })

    await this.sessionRepository.update(sessionId, {
      activeAvatarId: avatarId,
      lastActivityAt: now,
    })
    await this.syncGmCurrentAvatar(sessionId, avatarId)

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
    await hydrateConversationMemoryForNewConversation({
      input,
      ...(this.episodicMemoryService !== undefined
        ? { episodicMemoryService: this.episodicMemoryService }
        : {}),
      ...(this.conversationWorkingMemoryRepository !== undefined
        ? {
            conversationWorkingMemoryRepository: this.conversationWorkingMemoryRepository,
          }
        : {}),
      ...(this.eventLogRepository !== undefined
        ? { eventLogRepository: this.eventLogRepository }
        : {}),
    })
  }

  private async runBackgroundClosePipeline(input: {
    sessionId: string
    conversationId: string
    userId: string
    avatarId: string
    scenarioId: string
  }): Promise<void> {
    if (this.memoryMaintenance !== undefined) {
      try {
        await this.memoryMaintenance.execute({
          sessionId: input.sessionId,
          conversationId: input.conversationId,
          avatarId: input.avatarId,
          trigger: 'avatar_switch',
        })
      } catch (error: unknown) {
        console.error('[start-conversation] Background memory refresh failed:', error)
      }
    }

    if (this.episodicMemoryService === undefined) return
    try {
      await this.episodicMemoryService.generateForClosedConversation(input)
    } catch (error: unknown) {
      console.error('[start-conversation] Background episodic generation failed:', error)
    }
  }

  private async syncGmCurrentAvatar(sessionId: string, avatarId: string): Promise<void> {
    if (this.gmStateRepository === undefined) return

    const currentState = await this.gmStateRepository.findBySessionId(sessionId)
    await this.gmStateRepository.save(sessionId, {
      progression: currentState?.progression ?? '',
      topicsCovered: currentState?.topicsCovered ?? [],
      interactionCount: currentState?.interactionCount ?? 0,
      currentAvatarId: avatarId,
    })
  }
}

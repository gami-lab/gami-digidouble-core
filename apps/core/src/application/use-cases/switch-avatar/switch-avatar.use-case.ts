import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { IConversationWorkingMemoryRepository } from '../../ports/IConversationWorkingMemoryRepository.js'
import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'
import type { IMemoryMaintenancePort } from '../../ports/IMemoryMaintenancePort.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { Conversation, Session } from '../../../domain/conversation/session.types.js'
import { DomainError } from '../../../domain/errors.js'
import type { RunGameMasterUseCase } from '../run-game-master/run-game-master.use-case.js'
import {
  hydrateConversationMemoryForNewConversation,
  type EpisodicMemoryHydrationService,
} from '../shared/hydrate-conversation-memory.js'
import type { SwitchAvatarInput, SwitchAvatarOutput } from './switch-avatar.types.js'

type EpisodicMemoryService = {
  generateForClosedConversation(input: {
    conversationId: string
    sessionId: string
    userId: string
    avatarId: string
    scenarioId: string
  }): Promise<unknown>
} & EpisodicMemoryHydrationService

export class SwitchAvatarUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly avatarRepository: IAvatarRepository,
    private readonly conversationRepository: IConversationRepository,
    private readonly memoryMaintenance?: IMemoryMaintenancePort,
    private readonly episodicMemoryService?: EpisodicMemoryService,
    private readonly conversationWorkingMemoryRepository?: IConversationWorkingMemoryRepository,
    private readonly eventLogRepository?: IEventLogRepository,
    private readonly runGameMasterUseCase?: RunGameMasterUseCase | null,
  ) {}

  async execute(input: SwitchAvatarInput): Promise<SwitchAvatarOutput> {
    const { sessionId, avatarId } = this.validateInput(input)
    const session = await this.loadActiveSession(sessionId)
    await this.ensureAvatarBelongsToScenario(avatarId, session.scenarioId)
    this.ensureAvatarIsUnlocked(session, avatarId)

    const previousConversation = await this.conversationRepository.findActiveBySessionId(sessionId)
    const now = new Date().toISOString()

    await this.closePreviousConversation(previousConversation?.conversationId, now)
    if (previousConversation !== null) {
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
      reason: input.reason ?? 'manual_switch',
      ...(previousConversation !== null
        ? { handoffFromConversationId: previousConversation.conversationId }
        : {}),
    })

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

    const updatedSession = await this.sessionRepository.findById(sessionId)
    if (updatedSession === null) {
      throw new DomainError('NOT_FOUND', `Session ${sessionId} was not found.`)
    }

    await this.runInitialGameMaster({
      sessionId,
      scenarioId: session.scenarioId,
      avatarId,
      conversationId: conversation.conversationId,
    })

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
          scenarioId: input.scenarioId,
          trigger: 'avatar_switch',
        })
      } catch (error: unknown) {
        console.error('[switch-avatar] Background memory refresh failed:', error)
      }
    }

    await this.generateEpisodicMemory(input)
  }

  private async generateEpisodicMemory(input: {
    sessionId: string
    conversationId: string
    userId: string
    avatarId: string
    scenarioId: string
  }): Promise<void> {
    if (this.episodicMemoryService === undefined) return
    try {
      await this.episodicMemoryService.generateForClosedConversation(input)
    } catch (error: unknown) {
      console.error('[switch-avatar] Background episodic generation failed:', error)
    }
  }

  /**
   * Runs the GM before any user message exists so the newly active avatar's
   * very first reply after a switch also carries director guidance.
   * Session start is allowed to wait for this preparation; GM failures remain
   * non-fatal to the avatar switch.
   */
  private async runInitialGameMaster(args: {
    sessionId: string
    scenarioId: string
    avatarId: string
    conversationId: string
  }): Promise<void> {
    if (this.runGameMasterUseCase === undefined || this.runGameMasterUseCase === null) return

    try {
      await this.runGameMasterUseCase.execute({
        sessionId: args.sessionId,
        scenarioId: args.scenarioId,
        avatarId: args.avatarId,
        conversationId: args.conversationId,
        userMessageText: '',
        turnIndex: 0,
        correlationId: crypto.randomUUID(),
      })
    } catch (err: unknown) {
      console.error('[switch-avatar] Initial GM run failed for session:', args.sessionId, err)
    }
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

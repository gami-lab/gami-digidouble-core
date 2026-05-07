import crypto from 'node:crypto'
import type { IAvatarSessionMemoryRepository } from '../../ports/IAvatarSessionMemoryRepository.js'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'
import type { IMessageRepository } from '../../ports/IMessageRepository.js'
import type { IMemoryMaintenancePort } from '../../ports/IMemoryMaintenancePort.js'
import type { ISessionMemoryRepository } from '../../ports/ISessionMemoryRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { IUserRepository } from '../../ports/IUserRepository.js'
import type { RunGameMasterUseCase } from '../run-game-master/run-game-master.use-case.js'
import { DomainError } from '../../../domain/errors.js'
import type {
  ClearMemoryInput,
  ClearMemoryOutput,
  RefreshMemoryInput,
  RefreshMemoryOutput,
  ReplayGmInput,
  ReplayGmOutput,
} from './admin-runtime-actions.types.js'

const GM_RECENT_MESSAGES_LIMIT = 20

export class AdminRuntimeActionsUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly conversationRepository: IConversationRepository,
    private readonly messageRepository: IMessageRepository,
    private readonly eventLogRepository: IEventLogRepository,
    private readonly sessionMemoryRepository?: ISessionMemoryRepository,
    private readonly avatarSessionMemoryRepository?: IAvatarSessionMemoryRepository,
    private readonly memoryMaintenance?: IMemoryMaintenancePort,
    private readonly runGameMasterUseCase?: RunGameMasterUseCase,
    private readonly userRepository?: IUserRepository,
  ) {}

  async replayGm(input: ReplayGmInput): Promise<ReplayGmOutput> {
    const session = await this.requireSession(input.sessionId)
    const replayTarget = await this.resolveReplayTarget(input.sessionId)
    if (this.runGameMasterUseCase === undefined) {
      throw new DomainError('INTERNAL_ERROR', 'GM replay is not available in this runtime.')
    }

    const correlationId = `admin_gm_replay_${crypto.randomUUID()}`
    void this.runGameMasterUseCase
      .execute({
        sessionId: input.sessionId,
        scenarioId: session.scenarioId,
        avatarId: replayTarget.avatarId,
        conversationId: replayTarget.conversationId,
        userMessageText: replayTarget.userMessageText,
        turnIndex: replayTarget.turnIndex,
        correlationId,
        ...(replayTarget.userPersona !== undefined
          ? { userPersona: replayTarget.userPersona }
          : {}),
      })
      .catch((error: unknown) => {
        console.error('[admin-runtime-actions] GM replay failed:', error)
      })

    await this.appendAuditEvent({
      sessionId: input.sessionId,
      correlationId,
      type: 'admin_action.gm_replay',
      payload: {
        actionType: 'session.gm_replay',
        targetType: 'session',
        targetId: input.sessionId,
        conversationId: replayTarget.conversationId,
        avatarId: replayTarget.avatarId,
      },
    })

    return {
      sessionId: input.sessionId,
      action: 'gm.replay',
      scheduled: true,
      correlationId,
      conversationId: replayTarget.conversationId,
      avatarId: replayTarget.avatarId,
      turnIndex: replayTarget.turnIndex,
    }
  }

  async refreshMemory(input: RefreshMemoryInput): Promise<RefreshMemoryOutput> {
    await this.requireSession(input.sessionId)
    const conversation = await this.resolveLatestConversation(input.sessionId)
    if (conversation === null) {
      throw new DomainError(
        'CONFLICT',
        `Cannot refresh memory for session ${input.sessionId} without a conversation.`,
      )
    }
    if (this.memoryMaintenance === undefined) {
      throw new DomainError('INTERNAL_ERROR', 'Memory refresh is not available in this runtime.')
    }

    const correlationId = `admin_memory_refresh_${crypto.randomUUID()}`
    void this.memoryMaintenance
      .execute({
        sessionId: input.sessionId,
        conversationId: conversation.conversationId,
        avatarId: conversation.avatarId,
        trigger: 'post_turn',
        correlationId,
      })
      .catch((error: unknown) => {
        console.error('[admin-runtime-actions] Memory refresh failed:', error)
      })

    await this.appendAuditEvent({
      sessionId: input.sessionId,
      correlationId,
      type: 'admin_action.memory_refresh',
      payload: {
        actionType: 'session.memory_refresh',
        targetType: 'session',
        targetId: input.sessionId,
        conversationId: conversation.conversationId,
        avatarId: conversation.avatarId,
      },
    })

    return {
      sessionId: input.sessionId,
      action: 'memory.refresh',
      scheduled: true,
      correlationId,
      conversationId: conversation.conversationId,
      avatarId: conversation.avatarId,
    }
  }

  async clearMemory(input: ClearMemoryInput): Promise<ClearMemoryOutput> {
    const session = await this.requireSession(input.sessionId)
    const deletedSessionMemory =
      (await this.sessionMemoryRepository?.deleteBySessionId(input.sessionId)) ?? false
    const deletedAvatarMemories =
      (await this.avatarSessionMemoryRepository?.deleteBySessionId(input.sessionId)) ?? 0

    await this.sessionRepository.update(input.sessionId, {
      gmNotes: null,
      memorySummary: null,
      lastActivityAt: new Date().toISOString(),
    })

    const gmNotesCleared = session.gmNotes !== undefined
    const legacySessionSummaryCleared = session.memorySummary !== undefined

    await this.appendAuditEvent({
      sessionId: input.sessionId,
      type: 'admin_action.memory_clear',
      payload: {
        actionType: 'session.memory_clear',
        targetType: 'session',
        targetId: input.sessionId,
        sessionWorkingMemory: deletedSessionMemory,
        avatarWorkingMemoryCount: deletedAvatarMemories,
        gmNotesCleared,
        legacySessionSummaryCleared,
        userFactsCleared: false,
      },
    })

    return {
      sessionId: input.sessionId,
      action: 'memory.clear',
      cleared: {
        sessionWorkingMemory: deletedSessionMemory,
        avatarWorkingMemoryCount: deletedAvatarMemories,
        gmNotesCleared,
        legacySessionSummaryCleared,
        userFactsCleared: false,
      },
    }
  }

  private async resolveReplayTarget(sessionId: string) {
    const conversation = await this.resolveLatestConversation(sessionId)
    if (conversation === null) {
      throw new DomainError(
        'CONFLICT',
        `Cannot replay GM for session ${sessionId} without a conversation.`,
      )
    }

    const messages = await this.messageRepository.findByConversationId(
      conversation.conversationId,
      {
        limit: GM_RECENT_MESSAGES_LIMIT,
      },
    )
    const sorted = messages
      .slice()
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    const lastUserMessage = [...sorted].reverse().find((message) => message.role === 'user')
    if (lastUserMessage === undefined) {
      throw new DomainError(
        'CONFLICT',
        `Cannot replay GM for session ${sessionId} without a user turn.`,
      )
    }

    const turnIndex = sorted.filter((message) => message.role === 'user').length
    const userPersona = await this.loadUserPersona(sessionId)
    return {
      conversationId: conversation.conversationId,
      avatarId: conversation.avatarId,
      userMessageText: lastUserMessage.content,
      turnIndex: Math.max(1, turnIndex),
      ...(userPersona !== undefined ? { userPersona } : {}),
    }
  }

  private async resolveLatestConversation(sessionId: string) {
    const active = await this.conversationRepository.findActiveBySessionId(sessionId)
    if (active !== null) return active
    const conversations = await this.conversationRepository.listBySessionId(sessionId)
    const sorted = conversations
      .slice()
      .sort((a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt))
    return sorted[0] ?? null
  }

  private async requireSession(sessionId: string) {
    const session = await this.sessionRepository.findById(sessionId)
    if (session === null) {
      throw new DomainError('NOT_FOUND', `Session ${sessionId} was not found.`)
    }
    return session
  }

  private async loadUserPersona(sessionId: string) {
    const session = await this.sessionRepository.findById(sessionId)
    if (session === null || this.userRepository === undefined) return undefined
    try {
      const user = await this.userRepository.findById(session.userId)
      return user?.persona
    } catch {
      return undefined
    }
  }

  private async appendAuditEvent(args: {
    sessionId: string
    type: string
    correlationId?: string
    payload: Record<string, unknown>
  }) {
    await this.eventLogRepository.append({
      sessionId: args.sessionId,
      type: args.type,
      severity: 'info',
      ...(args.correlationId !== undefined ? { correlationId: args.correlationId } : {}),
      requestId: crypto.randomUUID(),
      payload: args.payload,
    })
  }
}

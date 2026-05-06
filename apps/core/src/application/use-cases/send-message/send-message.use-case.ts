import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'
import type { ILlmAdapter } from '../../ports/ILlmAdapter.js'
import type { IMessageRepository } from '../../ports/IMessageRepository.js'
import type { IMemoryMaintenancePort } from '../../ports/IMemoryMaintenancePort.js'
import type { IObservabilityAdapter } from '../../ports/IObservabilityAdapter.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import type { ISessionMemoryRepository } from '../../ports/ISessionMemoryRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { IUserMemoryFactRepository } from '../../ports/IUserMemoryFactRepository.js'
import type { IUserRepository } from '../../ports/IUserRepository.js'
import type { IAvatarSessionMemoryRepository } from '../../ports/IAvatarSessionMemoryRepository.js'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import { buildAvatarAwareness } from '../../../domain/avatar/avatar-awareness.service.js'
import { assemblePersonaPrompt } from '../../../domain/avatar/persona-prompt.service.js'
import type { Conversation, Message, Session } from '../../../domain/conversation/session.types.js'
import { DomainError } from '../../../domain/errors.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import type { UserPersona } from '../../../domain/user/user.types.js'
import type { ConversationEndReason, EndConversationResponse } from '@gami/shared'
import type { RunGameMasterUseCase } from '../run-game-master/run-game-master.use-case.js'
import {
  emitTurnCompletedEventNonBlocking,
  traceNonBlocking,
} from './send-message.observability.js'
import { AvatarMemoryContextAssembler } from '../../services/avatar-memory-context-assembler.service.js'
import {
  DEFAULT_IMPLICIT_END_POLICY,
  detectImplicitEndReason,
  type ImplicitEndPolicy,
} from '../../services/implicit-end-detection.service.js'
import type { SendMessageInput, SendMessageOutput } from './send-message.types.js'

const MESSAGE_HISTORY_LIMIT = 20
type ConversationCloser = {
  execute(input: {
    sessionId: string
    conversationId: string
    reason?: ConversationEndReason
  }): Promise<EndConversationResponse>
}

export class SendMessageUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly conversationRepository: IConversationRepository,
    private readonly avatarRepository: IAvatarRepository,
    private readonly scenarioRepository: IScenarioRepository,
    private readonly messageRepository: IMessageRepository,
    private readonly llm: ILlmAdapter,
    private readonly eventLogRepository: IEventLogRepository,
    private readonly observability: IObservabilityAdapter,
    private readonly runGameMasterUseCase: RunGameMasterUseCase | null = null,
    private readonly userRepository?: IUserRepository,
    private readonly endConversationUseCase: ConversationCloser | null = null,
    private readonly implicitEndPolicy: ImplicitEndPolicy = DEFAULT_IMPLICIT_END_POLICY,
    private readonly userMemoryFactRepository?: IUserMemoryFactRepository,
    private readonly memoryMaintenance?: IMemoryMaintenancePort,
    private readonly sessionMemoryRepository?: ISessionMemoryRepository,
    private readonly avatarSessionMemoryRepository?: IAvatarSessionMemoryRepository,
    private readonly memoryContextAssembler?: AvatarMemoryContextAssembler,
  ) {}

  async execute(input: SendMessageInput): Promise<SendMessageOutput> {
    this.validateInput(input)

    const requestId = crypto.randomUUID()
    const start = Date.now()

    const conversation = await this.loadActiveConversation(input.conversationId)
    const session = await this.loadActiveSession(conversation.sessionId)
    const avatar = await this.loadAvatar(conversation.avatarId)
    const { systemPrompt, userPersona } = await this.buildTurnPromptContext({
      session,
      conversation,
      avatar,
    })
    const historyMessages = await this.buildHistoryMessages(conversation.conversationId)
    const userMessage = await this.persistUserMessage(
      conversation.conversationId,
      input.userMessage,
    )
    const llmRequest = {
      systemPrompt,
      messages: [...historyMessages, { role: 'user' as const, content: userMessage.content }],
    }
    const response = await this.llm.complete(llmRequest)
    const avatarMessage = await this.persistAvatarMessage(conversation.conversationId, {
      ...response,
    })
    const now = this.nowIso()
    await this.conversationRepository.update(conversation.conversationId, { lastActivityAt: now })
    const updatedSession = await this.sessionRepository.update(session.sessionId, {
      lastActivityAt: now,
      ...(session.gmNotes !== undefined ? { gmNotes: null } : {}),
    })

    const nextTurnIndex = historyMessages.filter((message) => message.role === 'user').length + 1
    this.dispatchBackgroundUpdates({
      requestId,
      sessionId: session.sessionId,
      scenarioId: session.scenarioId,
      conversationId: conversation.conversationId,
      avatarId: conversation.avatarId,
      userMessage: input.userMessage,
      turnIndex: nextTurnIndex,
      userPersona,
    })

    const latencyMs = Date.now() - start
    emitTurnCompletedEventNonBlocking({
      requestId,
      sessionId: session.sessionId,
      conversationId: conversation.conversationId,
      turnIndex: nextTurnIndex,
      avatarId: conversation.avatarId,
      avatarLatencyMs: response.latencyMs,
      totalTurnLatencyMs: latencyMs,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      model: response.model,
      hasGm: this.runGameMasterUseCase !== null,
      eventLogRepository: this.eventLogRepository,
    })
    traceNonBlocking({
      requestId,
      sessionId: session.sessionId,
      llmRequest,
      response,
      latencyMs,
      observability: this.observability,
    })

    const output = this.buildOutput(
      requestId,
      conversation,
      updatedSession,
      userMessage,
      avatarMessage,
      response,
      now,
    )

    const implicitEnd = await this.tryImplicitClose({
      requestId,
      sessionId: session.sessionId,
      conversationId: conversation.conversationId,
      userMessage: input.userMessage,
      lastActivityAtBeforeTurn: conversation.lastActivityAt,
      now,
    })
    if (implicitEnd !== null) {
      output.conversation.status = implicitEnd.conversation.status
      output.conversation.lastActivityAt = implicitEnd.conversation.lastActivityAt
      if (implicitEnd.conversation.endedAt !== undefined) {
        output.conversation.endedAt = implicitEnd.conversation.endedAt
      }
    }

    return output
  }

  private async buildTurnPromptContext(args: {
    session: Session
    conversation: Conversation
    avatar: AvatarConfig
  }): Promise<{ systemPrompt: string; userPersona: UserPersona | undefined }> {
    await this.loadScenario(args.session.scenarioId)
    const scenarioAvatars = await this.avatarRepository.listByScenarioId(args.session.scenarioId)
    const userPersona = await this.loadUserPersona(args.session.userId)
    const memory = await this.loadAvatarMemoryContext({
      conversationId: args.conversation.conversationId,
      sessionId: args.session.sessionId,
      avatarId: args.conversation.avatarId,
      userId: args.session.userId,
    })

    const systemPrompt = assemblePersonaPrompt(args.avatar, {
      ...(args.session.gmNotes !== undefined ? { gmNotes: args.session.gmNotes } : {}),
      avatarAwareness: buildAvatarAwareness(
        args.avatar,
        scenarioAvatars,
        args.session.unlockedAvatarIds,
      ),
      ...(userPersona !== undefined ? { userPersona } : {}),
      ...(memory !== undefined ? { memory } : {}),
    })
    return { systemPrompt, userPersona }
  }

  private dispatchBackgroundUpdates(args: {
    requestId: string
    sessionId: string
    scenarioId: string
    conversationId: string
    avatarId: string
    userMessage: string
    turnIndex: number
    userPersona: UserPersona | undefined
  }): void {
    this.dispatchRunGameMaster(args)
    this.dispatchMemoryMaintenance(args)
  }

  private dispatchRunGameMaster(args: {
    requestId: string
    sessionId: string
    scenarioId: string
    conversationId: string
    avatarId: string
    userMessage: string
    turnIndex: number
    userPersona: UserPersona | undefined
  }): void {
    if (this.runGameMasterUseCase === null) return
    void this.runGameMasterUseCase
      .execute({
        sessionId: args.sessionId,
        scenarioId: args.scenarioId,
        avatarId: args.avatarId,
        conversationId: args.conversationId,
        userMessageText: args.userMessage,
        turnIndex: args.turnIndex,
        correlationId: args.requestId,
        ...(args.userPersona !== undefined ? { userPersona: args.userPersona } : {}),
      })
      .catch((err: unknown) => {
        console.error(
          '[GM] Background execution failed for session:',
          args.sessionId,
          'correlationId:',
          args.requestId,
          err,
        )
      })
  }

  private dispatchMemoryMaintenance(args: {
    requestId: string
    sessionId: string
    conversationId: string
    avatarId: string
  }): void {
    if (this.memoryMaintenance === undefined) return
    void this.memoryMaintenance.execute({
      sessionId: args.sessionId,
      conversationId: args.conversationId,
      avatarId: args.avatarId,
      trigger: 'post_turn',
      correlationId: args.requestId,
    })
  }

  private buildOutput(
    requestId: string,
    conversation: Conversation,
    updatedSession: Session,
    userMessage: Message,
    avatarMessage: Message,
    response: { model: string; inputTokens: number; outputTokens: number; latencyMs: number },
    now: string,
  ): SendMessageOutput {
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

  private validateInput(input: SendMessageInput): void {
    if (!hasText(input.conversationId)) {
      throw new DomainError('INVALID_INPUT', 'conversationId must be a non-empty string.')
    }
    if (!hasText(input.userMessage)) {
      throw new DomainError('INVALID_INPUT', 'userMessage must be a non-empty string.')
    }
  }

  private async loadActiveConversation(conversationId: string): Promise<Conversation> {
    const conversation = await this.conversationRepository.findById(conversationId)
    if (conversation === null) {
      throw new DomainError('NOT_FOUND', `Conversation ${conversationId} was not found.`)
    }
    if (conversation.status !== 'active') {
      throw new DomainError('CONFLICT', `Conversation ${conversationId} is not active.`)
    }
    return conversation
  }

  private async loadActiveSession(sessionId: string): Promise<Session> {
    const session = await this.sessionRepository.findById(sessionId)
    if (session === null) {
      throw new DomainError('NOT_FOUND', `Session ${sessionId} was not found.`)
    }
    if (session.status !== 'active') {
      throw new DomainError('CONFLICT', `Session ${sessionId} is not active.`)
    }
    return session
  }

  private async loadAvatar(avatarId: string): Promise<AvatarConfig> {
    const avatar = await this.avatarRepository.findById(avatarId)
    if (avatar === null) {
      throw new DomainError('NOT_FOUND', `Avatar ${avatarId} was not found.`)
    }
    return avatar
  }

  private async loadScenario(scenarioId: string): Promise<Scenario> {
    const scenario = await this.scenarioRepository.findById(scenarioId)
    if (scenario === null) {
      throw new DomainError('NOT_FOUND', `Scenario ${scenarioId} was not found.`)
    }
    return scenario
  }

  private async buildHistoryMessages(
    conversationId: string,
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const history = await this.messageRepository.findByConversationId(conversationId, {
      limit: MESSAGE_HISTORY_LIMIT,
    })
    const recentHistory = history
      .slice()
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .slice(-MESSAGE_HISTORY_LIMIT)

    return recentHistory.reduce<Array<{ role: 'user' | 'assistant'; content: string }>>(
      (messages, message) => {
        if (message.role === 'user') {
          messages.push({ role: 'user', content: message.content })
          return messages
        }
        if (message.role === 'avatar') {
          messages.push({ role: 'assistant', content: message.content })
        }
        return messages
      },
      [],
    )
  }

  private persistUserMessage(conversationId: string, content: string): Promise<Message> {
    return this.messageRepository.save({
      messageId: this.createMessageId(),
      conversationId,
      role: 'user',
      content,
      createdAt: this.nowIso(),
    })
  }

  private persistAvatarMessage(
    conversationId: string,
    response: {
      content: string
      model: string
      inputTokens: number
      outputTokens: number
      latencyMs: number
    },
  ): Promise<Message> {
    return this.messageRepository.save({
      messageId: this.createMessageId(),
      conversationId,
      role: 'avatar',
      content: response.content,
      createdAt: this.nowIso(),
      metadata: {
        model: response.model,
        latencyMs: response.latencyMs,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        totalTokens: response.inputTokens + response.outputTokens,
      },
    })
  }

  private async loadUserPersona(userId: string): Promise<UserPersona | undefined> {
    if (this.userRepository === undefined) return undefined
    try {
      const user = await this.userRepository.findById(userId)
      return user?.persona
    } catch {
      return undefined
    }
  }

  private async loadAvatarMemoryContext(input: {
    conversationId: string
    sessionId: string
    avatarId: string
    userId: string
  }) {
    const assembler =
      this.memoryContextAssembler ??
      new AvatarMemoryContextAssembler(
        this.messageRepository,
        this.sessionMemoryRepository,
        this.avatarSessionMemoryRepository,
        this.userMemoryFactRepository,
      )

    return assembler.build(input)
  }

  private createMessageId(): string {
    return `msg_${crypto.randomUUID()}`
  }

  private nowIso(): string {
    return new Date().toISOString()
  }

  private async tryImplicitClose(args: {
    requestId: string
    sessionId: string
    conversationId: string
    userMessage: string
    lastActivityAtBeforeTurn: string
    now: string
  }) {
    if (this.endConversationUseCase === null) return null

    const reason = detectImplicitEndReason({
      userMessage: args.userMessage,
      lastActivityAt: args.lastActivityAtBeforeTurn,
      now: args.now,
      policy: this.implicitEndPolicy,
    })
    if (reason === null) return null

    await this.appendEventSafe({
      sessionId: args.sessionId,
      type: 'implicit_end_detected',
      severity: 'info',
      requestId: args.requestId,
      payload: {
        conversationId: args.conversationId,
        reason,
      },
    })

    try {
      const closed = await this.endConversationUseCase.execute({
        sessionId: args.sessionId,
        conversationId: args.conversationId,
        reason,
      })
      await this.appendEventSafe({
        sessionId: args.sessionId,
        type: 'implicit_end_closed',
        severity: 'info',
        requestId: args.requestId,
        payload: {
          conversationId: args.conversationId,
          reason,
        },
      })
      return closed
    } catch (error) {
      await this.appendEventSafe({
        sessionId: args.sessionId,
        type: 'implicit_end_skipped',
        severity: 'warning',
        requestId: args.requestId,
        payload: {
          conversationId: args.conversationId,
          reason,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      })
      return null
    }
  }

  private async appendEventSafe(args: Parameters<IEventLogRepository['append']>[0]): Promise<void> {
    try {
      await this.eventLogRepository.append(args)
    } catch (error) {
      console.error('[send-message] Event log append failed:', error)
    }
  }
}

function hasText(value: string): boolean {
  return value.trim().length > 0
}

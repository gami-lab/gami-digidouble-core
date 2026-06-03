/* eslint-disable max-lines, max-lines-per-function */
import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'
import type { ILlmAdapter } from '../../ports/ILlmAdapter.js'
import type { IMessageRepository } from '../../ports/IMessageRepository.js'
import type { IMemoryMaintenancePort } from '../../ports/IMemoryMaintenancePort.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { IUserMemoryFactRepository } from '../../ports/IUserMemoryFactRepository.js'
import type { IUserRepository } from '../../ports/IUserRepository.js'
import type { IConversationWorkingMemoryRepository } from '../../ports/IConversationWorkingMemoryRepository.js'
import type { IConversationMemoryRepository } from '../../ports/IConversationMemoryRepository.js'
import type { IModelConfigRepository } from '../../ports/IModelConfigRepository.js'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import { buildAvatarAwareness } from '../../../domain/avatar/avatar-awareness.service.js'
import { assemblePersonaPrompt } from '../../../domain/avatar/persona-prompt.service.js'
import { ContextEngine } from '../../../domain/context/context-engine.service.js'
import type { Conversation, Message, Session } from '../../../domain/conversation/session.types.js'
import { DomainError } from '../../../domain/errors.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import type { UserPersona } from '../../../domain/user/user.types.js'
import type { ConversationEndReason, EndConversationResponse } from '@gami/shared'
import type { SelectedMemoryPayload } from '../../../domain/memory/memory.types.js'
import type { RunGameMasterUseCase } from '../run-game-master/run-game-master.use-case.js'
import { emitTurnCompletedEventNonBlocking } from './send-message.observability.js'
import { MemorySelectionService } from '../../services/memory-selection.service.js'
import {
  logResolvedLlmCall,
  resolveRoleLlmCall,
} from '../../services/model-resolution-runtime.service.js'
import { TypedRetrievalService } from '../../services/knowledge/typed-retrieval.service.js'
import {
  DEFAULT_IMPLICIT_END_POLICY,
  type ImplicitEndPolicy,
} from '../../services/implicit-end-detection.service.js'
import type { SendMessageInput, SendMessageOutput } from './send-message.types.js'
import { tryImplicitClose } from './send-message.implicit-close.js'
import {
  hasSelectedMemoryContent,
  hasText,
  toLlmDialogueMessages,
  toRecentExchanges,
} from './send-message.helpers.js'
import type { ContextEngineOutput } from '../../../domain/context/context-engine.types.js'
import type { ModelConfig } from '../../../domain/model-config/index.js'
import type { LlmAdapterRegistry } from '../../../infrastructure/llm/llm-adapter-registry.js'
import { toGameMasterAvailableAvatars } from '../run-game-master/run-game-master.avatar-unlocks.js'
import {
  toLayeredSnapshotFromAvatarContext,
  toScenarioSnapshot,
} from './send-message.context-engine.js'
import { buildSendMessageLlmRequest } from './send-message.llm-request.js'
import { buildSendMessageOutput } from './send-message.output.js'
import { toContextSelectionMetadata } from './send-message.context-selection.js'

const MESSAGE_HISTORY_FETCH_LIMIT = 30
const MESSAGE_HISTORY_EXCHANGE_LIMIT = 3

type ContextAssembler = {
  assemble(input: Parameters<ContextEngine['assemble']>[0]): ContextEngineOutput
}

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
    private readonly runGameMasterUseCase: RunGameMasterUseCase | null = null,
    private readonly userRepository?: IUserRepository,
    private readonly endConversationUseCase: ConversationCloser | null = null,
    private readonly implicitEndPolicy: ImplicitEndPolicy = DEFAULT_IMPLICIT_END_POLICY,
    private readonly userMemoryFactRepository?: IUserMemoryFactRepository,
    private readonly memoryMaintenance?: IMemoryMaintenancePort,
    private readonly conversationWorkingMemoryRepository?: IConversationWorkingMemoryRepository,
    private readonly conversationMemoryRepository?: IConversationMemoryRepository,
    private readonly memorySelectionService?: MemorySelectionService,
    private readonly typedRetrievalService?: TypedRetrievalService,
    private readonly contextAssembler: ContextAssembler = new ContextEngine(),
    private readonly modelConfigRepository?: IModelConfigRepository,
    private readonly llmAdapterRegistry?: LlmAdapterRegistry,
    private readonly modelConfigFallback?: ModelConfig,
  ) {}

  async execute(input: SendMessageInput): Promise<SendMessageOutput> {
    this.validateInput(input)

    const requestId = crypto.randomUUID()
    const start = Date.now()

    const conversation = await this.loadActiveConversation(input.conversationId)
    await this.awaitPendingWorkingMemoryRefresh(conversation.conversationId)
    const session = await this.loadActiveSession(conversation.sessionId)
    const avatar = await this.loadAvatar(conversation.avatarId)
    const { systemPrompt, userPersona, selectedMemory, assembledContext, retrievalLatencyMs } =
      await this.buildTurnPromptContext({
        session,
        conversation,
        avatar,
        userMessage: input.userMessage,
      })
    const priorUserTurnCount = await this.loadRecentUserTurnCount(conversation.conversationId)
    const historyMessages = await this.buildHistoryMessages(
      conversation.conversationId,
      selectedMemory,
    )
    const userMessage = await this.persistUserMessage(
      conversation.conversationId,
      input.userMessage,
    )
    const resolvedLlm = await resolveRoleLlmCall({
      role: 'avatar',
      legacyAdapter: this.llm,
      modelConfigRepository: this.modelConfigRepository,
      llmAdapterRegistry: this.llmAdapterRegistry,
      modelConfigFallback: this.modelConfigFallback,
      avatarOverride: avatar.llmOverride,
    })
    const llmRequest = buildSendMessageLlmRequest({
      requestId,
      sessionId: session.sessionId,
      conversationId: conversation.conversationId,
      avatarId: conversation.avatarId,
      systemPrompt,
      historyMessages,
      userMessage: userMessage.content,
      ...(resolvedLlm.model !== undefined ? { model: resolvedLlm.model } : {}),
      effectiveProvider: resolvedLlm.provider,
      effectiveModel: resolvedLlm.effectiveModel,
    })
    logResolvedLlmCall({
      role: 'avatar',
      effectiveProvider: resolvedLlm.provider,
      effectiveModel: resolvedLlm.effectiveModel,
    })
    const response = await resolvedLlm.adapter.complete(llmRequest)
    const avatarMessage = await this.persistAvatarMessage(conversation.conversationId, {
      ...response,
    })
    const now = this.nowIso()
    await this.conversationRepository.update(conversation.conversationId, { lastActivityAt: now })
    const updatedSession = await this.sessionRepository.update(session.sessionId, {
      lastActivityAt: now,
      ...(session.gmNotes !== undefined ? { gmNotes: null } : {}),
    })

    const nextTurnIndex = priorUserTurnCount + 1
    this.dispatchBackgroundUpdates({
      requestId,
      sessionId: session.sessionId,
      scenarioId: session.scenarioId,
      conversationId: conversation.conversationId,
      avatarId: conversation.avatarId,
      userMessage: input.userMessage,
      turnIndex: nextTurnIndex,
      userPersona,
      assembledContext,
      ...(selectedMemory !== undefined ? { selectedMemory } : {}),
    })

    const latencyMs = Date.now() - start
    const otherOverheadMs = Math.max(0, latencyMs - response.latencyMs - retrievalLatencyMs)
    emitTurnCompletedEventNonBlocking({
      requestId,
      sessionId: session.sessionId,
      conversationId: conversation.conversationId,
      turnIndex: nextTurnIndex,
      avatarId: conversation.avatarId,
      avatarContext: assembledContext.avatar,
      avatarLatencyMs: response.latencyMs,
      totalTurnLatencyMs: latencyMs,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      model: response.model,
      hasGm: this.runGameMasterUseCase !== null,
      retrievalLatencyMs,
      otherOverheadMs,
      contextSelection: toContextSelectionMetadata(assembledContext),
      eventLogRepository: this.eventLogRepository,
    })
    const output = buildSendMessageOutput({
      requestId,
      conversation,
      updatedSession,
      userMessage,
      avatarMessage,
      response,
      now,
    })

    const implicitEnd = await tryImplicitClose({
      endConversationUseCase: this.endConversationUseCase,
      eventLogRepository: this.eventLogRepository,
      implicitEndPolicy: this.implicitEndPolicy,
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
    userMessage: string
  }): Promise<{
    systemPrompt: string
    userPersona: UserPersona | undefined
    selectedMemory?: SelectedMemoryPayload
    assembledContext: ContextEngineOutput
    retrievalLatencyMs: number
  }> {
    const scenario = await this.loadScenario(args.session.scenarioId)
    const scenarioAvatars = await this.avatarRepository.listByScenarioId(args.session.scenarioId)
    const userPersona = await this.loadUserPersona(args.session.userId)
    const selectedMemory = await this.loadSelectedMemory({
      conversationId: args.conversation.conversationId,
      avatarId: args.conversation.avatarId,
      userId: args.session.userId,
      scenarioId: args.session.scenarioId,
      userMessageText: args.userMessage,
    })
    const memory =
      selectedMemory !== undefined
        ? this.getMemorySelectionService().toAvatarMemorySnapshot(selectedMemory)
        : undefined
    const retrievalStartMs = Date.now()
    const retrieval = await this.loadTypedRetrieval(
      args.session,
      args.conversation.conversationId,
      args.conversation.avatarId,
    )
    const retrievalForGm = await this.loadTypedRetrieval(
      args.session,
      args.conversation.conversationId,
      undefined,
      true,
    )
    const retrievalLatencyMs = Date.now() - retrievalStartMs
    const assembledContext = this.contextAssembler.assemble({
      sessionId: args.session.sessionId,
      activeAvatarId: args.conversation.avatarId,
      recentMessages: [{ role: 'user', content: args.userMessage }],
      scenario: toScenarioSnapshot(args.session, scenario),
      availableAvatars: toGameMasterAvailableAvatars(scenarioAvatars, args.session),
      gmState: {
        progression: '',
        topicsCovered: [],
        interactionCount: 0,
      },
      extensions: {
        memory,
        retrieval,
        ...(retrievalForGm !== undefined ? { retrievalForGm } : {}),
        userPersona: userPersona ?? null,
        gmDirective: args.session.gmNotes ?? null,
      },
    })

    const systemPrompt = assemblePersonaPrompt(args.avatar, {
      avatarAwareness: buildAvatarAwareness(
        args.avatar,
        scenarioAvatars,
        args.session.unlockedAvatarIds,
      ),
      ...(assembledContext.avatar.gmNotes !== null
        ? { gmNotes: assembledContext.avatar.gmNotes }
        : {}),
      ...(assembledContext.avatar.userPersona !== null
        ? { userPersona: assembledContext.avatar.userPersona }
        : {}),
      ...(() => {
        const snapshot = toLayeredSnapshotFromAvatarContext(assembledContext)
        return snapshot !== undefined ? { memory: snapshot } : {}
      })(),
      ...(assembledContext.avatar.knowledge?.typedSections !== undefined
        ? { retrieval: assembledContext.avatar.knowledge.typedSections }
        : {}),
    })
    return {
      systemPrompt,
      userPersona,
      assembledContext,
      retrievalLatencyMs,
      ...(selectedMemory !== undefined ? { selectedMemory } : {}),
    }
  }

  private async loadTypedRetrieval(
    session: Session,
    conversationId: string,
    avatarId: string | undefined,
    bypassVisibilityFilter = false,
  ) {
    if (this.typedRetrievalService === undefined) return undefined
    const recentMessages = await this.messageRepository.findByConversationId(conversationId, {
      limit: 12,
    })
    const query = recentMessages
      .slice()
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .filter((message) => message.role === 'user')
      .slice(-2)
      .map((message) => message.content.trim())
      .join(' ')
      .trim()
    if (!hasText(query)) return undefined

    return this.typedRetrievalService.retrieve({
      scenarioId: session.scenarioId,
      sessionId: session.sessionId,
      userId: session.userId,
      conversationId,
      ...(avatarId !== undefined ? { activeAvatarId: avatarId } : {}),
      ...(bypassVisibilityFilter ? { bypassVisibilityFilter: true } : {}),
      query,
      limitPerType: 3,
    })
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
    assembledContext: ContextEngineOutput
    selectedMemory?: SelectedMemoryPayload
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
    assembledContext: ContextEngineOutput
    selectedMemory?: SelectedMemoryPayload
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
        assembledContext: args.assembledContext,
        ...(args.selectedMemory !== undefined ? { selectedMemory: args.selectedMemory } : {}),
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
    void Promise.resolve(
      this.memoryMaintenance.execute({
        sessionId: args.sessionId,
        conversationId: args.conversationId,
        avatarId: args.avatarId,
        trigger: 'post_turn',
        correlationId: args.requestId,
      }),
    ).catch((error: unknown) => {
      console.error('[memory-maintenance] Background refresh failed:', error)
    })
  }

  private async awaitPendingWorkingMemoryRefresh(conversationId: string): Promise<void> {
    if (this.memoryMaintenance?.awaitPendingRefresh === undefined) return

    try {
      await this.memoryMaintenance.awaitPendingRefresh(conversationId)
    } catch (error) {
      console.error('[memory-maintenance] Await pending refresh failed:', error)
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
    selectedMemory: SelectedMemoryPayload | undefined,
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const selectedShortTerm = selectedMemory?.shortTermExchanges ?? []
    if (selectedShortTerm.length >= MESSAGE_HISTORY_EXCHANGE_LIMIT) {
      return toLlmDialogueMessages(selectedShortTerm.slice(-MESSAGE_HISTORY_EXCHANGE_LIMIT))
    }

    const history = await this.messageRepository.findByConversationId(conversationId, {
      limit: MESSAGE_HISTORY_FETCH_LIMIT,
    })
    const recentHistory = history
      .slice()
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .slice(-MESSAGE_HISTORY_FETCH_LIMIT)

    const recentExchanges = toRecentExchanges(recentHistory, MESSAGE_HISTORY_EXCHANGE_LIMIT)
    return toLlmDialogueMessages(recentExchanges)
  }

  private async loadRecentUserTurnCount(conversationId: string): Promise<number> {
    const history = await this.messageRepository.findByConversationId(conversationId, {
      limit: MESSAGE_HISTORY_FETCH_LIMIT,
    })
    return history.filter((message) => message.role === 'user').length
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

  private async loadSelectedMemory(input: {
    conversationId: string
    avatarId: string
    userId: string
    scenarioId: string
    userMessageText: string
  }) {
    try {
      const selected = await this.getMemorySelectionService().select(input)
      return hasSelectedMemoryContent(selected) ? selected : undefined
    } catch {
      return undefined
    }
  }

  private getMemorySelectionService(): MemorySelectionService {
    return (
      this.memorySelectionService ??
      new MemorySelectionService(
        this.messageRepository,
        this.conversationWorkingMemoryRepository,
        this.conversationMemoryRepository,
        this.userMemoryFactRepository,
      )
    )
  }

  private createMessageId(): string {
    return `msg_${crypto.randomUUID()}`
  }

  private nowIso(): string {
    return new Date().toISOString()
  }
}

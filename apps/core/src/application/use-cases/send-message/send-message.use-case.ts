/* eslint-disable max-lines */
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
import type { IGmStateRepository } from '../../ports/IGmStateRepository.js'
import type { IModelConfigRepository } from '../../ports/IModelConfigRepository.js'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import { buildAvatarAwareness } from '../../../domain/avatar/avatar-awareness.service.js'
import { cleanAvatarResponse } from '../../../domain/avatar/avatar-response-cleaner.js'
import { assemblePersonaPrompt } from '../../../domain/avatar/persona-prompt.service.js'
import { ContextEngine } from '../../../domain/context/context-engine.service.js'
import type { Conversation, Message, Session } from '../../../domain/conversation/session.types.js'
import { DomainError } from '../../../domain/errors.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import type { UserPersona } from '../../../domain/user/user.types.js'
import {
  AVATAR_RETRIEVAL_DEFAULT_MAX_CHUNKS,
  type ConversationEndReason,
  type EndConversationResponse,
} from '@gami/shared'
import type { SelectedMemoryPayload } from '../../../domain/memory/memory.types.js'
import type { RunGameMasterUseCase } from '../run-game-master/run-game-master.use-case.js'
import type {
  GameMasterOrchestrationState,
  GameMasterState,
} from '../../../domain/game-master/game-master.types.js'
import { emitTurnCompletedEventNonBlocking } from './send-message.observability.js'
import { MemorySelectionService } from '../../services/memory-selection.service.js'
import {
  logResolvedLlmCall,
  resolveRoleLlmCall,
} from '../../services/model-resolution-runtime.service.js'
import { TypedRetrievalService } from '../../services/knowledge/typed-retrieval.service.js'
import {
  buildAvatarTypedRetrievalQueries,
  flattenTypedRetrievalQueries,
} from '../../services/knowledge/typed-retrieval-query-builder.js'
import {
  DEFAULT_IMPLICIT_END_POLICY,
  type ImplicitEndPolicy,
} from '../../services/implicit-end-detection.service.js'
import type { SendMessageInput, SendMessageOutput } from './send-message.types.js'
import type { PreparedSendMessageTurn, SendMessageTurnResponse } from './send-message.turn.types.js'
import { tryImplicitClose } from './send-message.implicit-close.js'
import {
  hasSelectedMemoryContent,
  hasText,
  toLlmDialogueMessages,
  toRecentExchanges,
} from './send-message.helpers.js'
import type { ContextEngineOutput } from '../../../domain/context/context-engine.types.js'
import type { TypedRetrievalResult } from '../../../domain/knowledge/knowledge.types.js'
import type { ModelConfig } from '../../../domain/model-config/index.js'
import type { LlmAdapterRegistry } from '../../../infrastructure/llm/llm-adapter-registry.js'
import { toGameMasterAvailableAvatars } from '../run-game-master/run-game-master.avatar-unlocks.js'
import {
  toSelectedPromptIdentitySource,
  toScenarioSnapshot,
} from './send-message.context-engine.js'
import { buildSendMessageLlmRequest } from './send-message.llm-request.js'
import { buildSendMessageOutput } from './send-message.output.js'
import { toContextSelectionMetadata } from './send-message.context-selection.js'

const MESSAGE_HISTORY_EXCHANGE_LIMIT = 3
const MESSAGE_HISTORY_FETCH_LIMIT = MESSAGE_HISTORY_EXCHANGE_LIMIT * 2

function hasRetrievedKnowledge(retrieval: TypedRetrievalResult | undefined): boolean {
  return (
    retrieval !== undefined &&
    (retrieval.memory.length > 0 || retrieval.world.length > 0 || retrieval.media.length > 0)
  )
}

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
    private readonly gmStateRepository?: IGmStateRepository,
  ) {}

  async execute(input: SendMessageInput): Promise<SendMessageOutput> {
    const turn = await this.prepareTurn(input)
    const response = await turn.adapter.complete(turn.llmRequest)
    return this.completeTurn(turn, response)
  }

  async prepareTurn(input: SendMessageInput): Promise<PreparedSendMessageTurn> {
    this.validateInput(input)

    const requestId = crypto.randomUUID()
    const startedAtMs = Date.now()

    const conversation = await this.loadActiveConversation(input.conversationId)
    await this.awaitPendingWorkingMemoryRefresh(conversation.conversationId)
    const session = await this.loadActiveSession(conversation.sessionId)
    const avatar = await this.loadAvatar(conversation.avatarId)
    const gmState = await this.loadGmState(session.sessionId)
    const priorUserTurnCount =
      gmState?.interactionCount ?? (await this.loadRecentUserTurnCount(conversation.conversationId))
    const orchestration = await this.consumeNextTurnOrchestration({
      sessionId: session.sessionId,
      avatarId: conversation.avatarId,
      turnIndex: priorUserTurnCount + 1,
      state: gmState,
    })
    const {
      systemPrompt,
      userPersona,
      selectedMemory,
      assembledContext,
      retrievalLatencyMs,
      scenarioModelSelection,
    } = await this.buildTurnPromptContext({
      session,
      conversation,
      avatar,
      userMessage: input.userMessage,
      orchestration,
    })
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
      ...(input.model !== undefined ? { requestOverride: input.model } : {}),
      scenarioModelSelection,
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
      ...(resolvedLlm.serviceTier === undefined ? {} : { serviceTier: resolvedLlm.serviceTier }),
      effectiveProvider: resolvedLlm.provider,
      effectiveModel: resolvedLlm.effectiveModel,
    })
    logResolvedLlmCall({
      role: 'avatar',
      effectiveProvider: resolvedLlm.provider,
      effectiveModel: resolvedLlm.effectiveModel,
    })
    return {
      requestId,
      startedAtMs,
      input,
      conversation,
      session,
      avatar,
      userMessage,
      userPersona,
      selectedMemory,
      orchestration,
      assembledContext,
      retrievalLatencyMs,
      priorUserTurnCount,
      adapter: resolvedLlm.adapter,
      llmRequest,
    }
  }

  async completeTurn(
    turn: PreparedSendMessageTurn,
    response: SendMessageTurnResponse,
    options: { scheduleBackground?: boolean } = {},
  ): Promise<SendMessageOutput> {
    const cleanedResponse = { ...response, content: cleanAvatarResponse(response.content) }
    const avatarMessage = await this.persistAvatarMessage(turn.conversation.conversationId, {
      ...cleanedResponse,
    })
    const now = this.nowIso()
    await this.conversationRepository.update(turn.conversation.conversationId, {
      lastActivityAt: now,
    })
    const updatedSession = await this.sessionRepository.update(turn.session.sessionId, {
      lastActivityAt: now,
      ...(turn.session.gmNotes !== undefined ? { gmNotes: null } : {}),
    })

    await this.incrementInteractionCount(turn.session.sessionId)

    const nextTurnIndex = turn.priorUserTurnCount + 1
    if (options.scheduleBackground !== false) {
      this.schedulePostTurnWork(turn)
    }

    const latencyMs = Date.now() - turn.startedAtMs
    const otherOverheadMs = Math.max(0, latencyMs - response.latencyMs - turn.retrievalLatencyMs)
    emitTurnCompletedEventNonBlocking({
      requestId: turn.requestId,
      sessionId: turn.session.sessionId,
      conversationId: turn.conversation.conversationId,
      turnIndex: nextTurnIndex,
      avatarId: turn.conversation.avatarId,
      avatarContext: turn.assembledContext.avatar,
      avatarLatencyMs: response.latencyMs,
      totalTurnLatencyMs: latencyMs,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      model: response.model,
      hasGm: this.runGameMasterUseCase !== null,
      retrievalLatencyMs: turn.retrievalLatencyMs,
      otherOverheadMs,
      contextSelection: toContextSelectionMetadata(turn.assembledContext),
      ...(turn.orchestration !== undefined
        ? {
            consumedGmRetrievalPlan: {
              ...(turn.orchestration.generatedByCorrelationId !== undefined
                ? { generatedByCorrelationId: turn.orchestration.generatedByCorrelationId }
                : {}),
              generatedAfterTurn: turn.orchestration.generatedAfterTurn,
              generatedAt: turn.orchestration.generatedAt,
              consumedOnTurn: nextTurnIndex,
              required: turn.orchestration.retrievalPlan.required,
              queries: turn.orchestration.retrievalPlan.queries ?? [],
              requiredFacts: turn.orchestration.retrievalPlan.requiredFacts ?? [],
            },
          }
        : {}),
      eventLogRepository: this.eventLogRepository,
    })
    const output = buildSendMessageOutput({
      requestId: turn.requestId,
      conversation: turn.conversation,
      updatedSession,
      userMessage: turn.userMessage,
      avatarMessage,
      response: cleanedResponse,
      now,
    })

    const implicitEnd = await tryImplicitClose({
      endConversationUseCase: this.endConversationUseCase,
      eventLogRepository: this.eventLogRepository,
      implicitEndPolicy: this.implicitEndPolicy,
      requestId: turn.requestId,
      sessionId: turn.session.sessionId,
      conversationId: turn.conversation.conversationId,
      userMessage: turn.input.userMessage,
      lastActivityAtBeforeTurn: turn.conversation.lastActivityAt,
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

  schedulePostTurnWork(turn: PreparedSendMessageTurn): void {
    this.dispatchBackgroundUpdates({
      requestId: turn.requestId,
      sessionId: turn.session.sessionId,
      scenarioId: turn.session.scenarioId,
      conversationId: turn.conversation.conversationId,
      avatarId: turn.conversation.avatarId,
      userMessage: turn.input.userMessage,
      turnIndex: turn.priorUserTurnCount + 1,
      userPersona: turn.userPersona,
      ...(turn.selectedMemory !== undefined ? { selectedMemory: turn.selectedMemory } : {}),
    })
  }

  private async incrementInteractionCount(sessionId: string): Promise<void> {
    if (this.gmStateRepository === undefined) return

    const currentState = await this.gmStateRepository.findBySessionId(sessionId)
    const state: GameMasterState = currentState ?? {
      progression: '',
      interactionCount: 0,
    }
    await this.gmStateRepository.save(sessionId, {
      ...state,
      interactionCount: state.interactionCount + 1,
    })
  }

  private async loadGmState(sessionId: string): Promise<GameMasterState | null> {
    if (this.gmStateRepository === undefined) return null
    return await this.gmStateRepository.findBySessionId(sessionId)
  }

  // eslint-disable-next-line complexity, max-lines-per-function
  private async buildTurnPromptContext(args: {
    session: Session
    conversation: Conversation
    avatar: AvatarConfig
    userMessage: string
    orchestration: GameMasterOrchestrationState | undefined
  }): Promise<{
    systemPrompt: string
    userPersona: UserPersona | undefined
    selectedMemory?: SelectedMemoryPayload
    orchestration: GameMasterOrchestrationState | undefined
    assembledContext: ContextEngineOutput
    retrievalLatencyMs: number
    scenarioModelSelection: Scenario['modelSelection']
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
    const retrievalQueries = buildAvatarTypedRetrievalQueries({
      gmGuideline: args.orchestration?.directorNotes ?? args.session.gmNotes,
      gmRetrievalQueries: args.orchestration?.retrievalPlan.queries,
      gmRequiredFacts: args.orchestration?.retrievalPlan.requiredFacts,
      lastUserInput: args.userMessage,
      workingMemorySummary: memory?.working?.avatar?.summary ?? memory?.working?.session?.summary,
      recentExchanges: memory?.shortTerm?.recentExchanges,
    })
    const retrievalStartMs = Date.now()
    let retrieval: Awaited<ReturnType<SendMessageUseCase['loadTypedRetrieval']>>
    let retrievalFailed = false
    try {
      retrieval = await this.loadTypedRetrieval(
        args.session,
        args.conversation.conversationId,
        args.conversation.avatarId,
        retrievalQueries,
        args.session.avatarOptions?.retrieval,
      )
    } catch (error: unknown) {
      retrievalFailed = true
      retrieval = undefined
      console.error('[avatar-retrieval] Retrieval failed:', error)
    }
    const retrievalStatus =
      args.orchestration?.retrievalPlan.required === true &&
      (retrievalFailed || !hasRetrievedKnowledge(retrieval))
        ? ('insufficient_evidence' as const)
        : undefined
    const directorNotes = args.orchestration?.directorNotes ?? args.session.gmNotes
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
        ...(args.session.avatarOptions?.retrieval !== undefined
          ? { avatarRetrievalOptions: args.session.avatarOptions.retrieval }
          : {}),
        userPersona: userPersona ?? null,
        gmDirective: directorNotes ?? null,
        ...(args.avatar.adjustments !== undefined
          ? { responseRules: args.avatar.adjustments }
          : {}),
        ...(args.avatar.computedTraits !== undefined
          ? { avatarTraits: args.avatar.computedTraits }
          : {}),
      },
    })

    const selectedIdentitySource = toSelectedPromptIdentitySource(
      args.avatar,
      assembledContext.avatar.sections,
    )
    const systemPrompt = assemblePersonaPrompt(args.avatar, {
      sections: assembledContext.avatar.sections,
      ...(selectedIdentitySource !== undefined ? { identitySource: selectedIdentitySource } : {}),
      avatarAwareness: buildAvatarAwareness(
        args.avatar,
        scenarioAvatars,
        args.session.unlockedAvatarIds,
      ),
      ...(args.orchestration !== undefined
        ? {
            gmGuidance: {
              mode: args.orchestration.dialogueControl.mode,
              askFollowUp: args.orchestration.dialogueControl.askFollowUp,
              ...(directorNotes !== undefined ? { directorNotes } : {}),
              ...(retrievalStatus !== undefined ? { retrievalStatus } : {}),
            },
          }
        : {}),
      ...(args.session.avatarOptions?.retrieval !== undefined
        ? { retrievalOptions: args.session.avatarOptions.retrieval }
        : {}),
    })
    return {
      systemPrompt,
      userPersona,
      assembledContext,
      orchestration: args.orchestration,
      retrievalLatencyMs,
      scenarioModelSelection: scenario.modelSelection,
      ...(selectedMemory !== undefined ? { selectedMemory } : {}),
    }
  }

  private async loadTypedRetrieval(
    session: Session,
    conversationId: string,
    avatarId: string | undefined,
    queries: ReturnType<typeof buildAvatarTypedRetrievalQueries>,
    retrievalOptions: NonNullable<Session['avatarOptions']>['retrieval'] | undefined,
    bypassVisibilityFilter = false,
  ) {
    if (this.typedRetrievalService === undefined) return undefined
    const query = flattenTypedRetrievalQueries(queries)
    if (!hasText(query)) return undefined

    return this.typedRetrievalService.retrieve({
      scenarioId: session.scenarioId,
      sessionId: session.sessionId,
      userId: session.userId,
      conversationId,
      ...(avatarId !== undefined ? { activeAvatarId: avatarId } : {}),
      ...(bypassVisibilityFilter ? { bypassVisibilityFilter: true } : {}),
      query,
      queries,
      limitPerType: retrievalOptions?.maxChunks ?? AVATAR_RETRIEVAL_DEFAULT_MAX_CHUNKS,
    })
  }

  private async consumeNextTurnOrchestration(input: {
    sessionId: string
    avatarId: string
    turnIndex: number
    state: GameMasterState | null
  }): Promise<GameMasterOrchestrationState | undefined> {
    if (this.gmStateRepository === undefined) return undefined

    const state = input.state ?? (await this.gmStateRepository.findBySessionId(input.sessionId))
    const pending = state?.nextTurnOrchestration
    if (
      pending === undefined ||
      pending.consumedAfterTurn !== undefined ||
      pending.activeAvatarId !== input.avatarId ||
      pending.generatedAfterTurn !== input.turnIndex - 1
    ) {
      return undefined
    }

    const consumedState: GameMasterState = {
      ...(state as GameMasterState),
      nextTurnOrchestration: {
        ...pending,
        consumedAfterTurn: input.turnIndex,
        consumedAt: new Date().toISOString(),
      },
    }
    await this.gmStateRepository.save(input.sessionId, consumedState)
    return pending
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
    scenarioId: string
    conversationId: string
    avatarId: string
  }): void {
    if (this.memoryMaintenance === undefined) return
    void Promise.resolve(
      this.memoryMaintenance.execute({
        sessionId: args.sessionId,
        conversationId: args.conversationId,
        avatarId: args.avatarId,
        scenarioId: args.scenarioId,
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
    const sessionSummary = selectedMemory?.workingMemory?.summary.trim()
    const summaryMessages =
      sessionSummary !== undefined && sessionSummary.length > 0
        ? [
            {
              role: 'assistant' as const,
              content: `Summary of previous conversation (context only, not a new reply):\n${sessionSummary}`,
            },
          ]
        : []
    const selectedShortTerm = selectedMemory?.shortTermExchanges ?? []
    if (selectedShortTerm.length >= MESSAGE_HISTORY_EXCHANGE_LIMIT) {
      return [
        ...summaryMessages,
        ...toLlmDialogueMessages(selectedShortTerm.slice(-MESSAGE_HISTORY_EXCHANGE_LIMIT)),
      ]
    }

    const history = await this.messageRepository.findByConversationId(conversationId, {
      limit: MESSAGE_HISTORY_FETCH_LIMIT,
    })
    const recentHistory = history
      .slice()
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .slice(-MESSAGE_HISTORY_FETCH_LIMIT)

    const recentExchanges = toRecentExchanges(recentHistory, MESSAGE_HISTORY_EXCHANGE_LIMIT)
    return [...summaryMessages, ...toLlmDialogueMessages(recentExchanges)]
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

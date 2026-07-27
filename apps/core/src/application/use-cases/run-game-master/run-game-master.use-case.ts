/* eslint-disable max-lines */
import crypto from 'node:crypto'
import type { RuntimeEvent } from '@gami/shared'
import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'
import type { IGmStateRepository } from '../../ports/IGmStateRepository.js'
import type { ILlmAdapter, LlmResponse } from '../../ports/ILlmAdapter.js'
import type { IMessageRepository } from '../../ports/IMessageRepository.js'
import type { IObservabilityAdapter } from '../../ports/IObservabilityAdapter.js'
import type { IModelConfigRepository } from '../../ports/IModelConfigRepository.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { ISessionEventPublisher } from '../../ports/ISessionEventPublisher.js'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { ContextScenarioSnapshot } from '../../../domain/context/session-context.types.js'
import {
  GAME_MASTER_INPUT_RENDERER_VERSION,
  renderGameMasterInputForLlm,
} from '../../../domain/game-master/gm-input-renderer.js'
import { normalizeGameMasterOutput } from '../../../domain/game-master/gm-output-normalization.js'
import { safeParseGameMasterOutput } from '../../../domain/game-master/gm-output-parser.js'
import {
  buildGameMasterSystemPrompt,
  GAME_MASTER_SYSTEM_PROMPT_VERSION,
} from '../../../domain/game-master/gm-prompt.service.js'
import { reduceGmState } from '../../../domain/game-master/gm-state-reducer.js'
import type {
  GameMasterInput,
  GameMasterOrchestrationState,
  GameMasterOutput,
  GameMasterState,
} from '../../../domain/game-master/game-master.types.js'
import type { Session } from '../../../domain/conversation/session.types.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import type { RunGameMasterInput } from './run-game-master.types.js'
import { MemorySelectionService } from '../../services/memory-selection.service.js'
import { toGameMasterMemoryContext } from '../../services/memory-selection-context.js'
import {
  logResolvedLlmCall,
  resolveRoleLlmCall,
} from '../../services/model-resolution-runtime.service.js'
import { type UnlockEvaluation, resolveAvatarUnlocks } from './run-game-master.avatar-unlocks.js'
import { buildGmContextSnapshot } from './run-game-master.context-engine.js'
import {
  emitGameMasterError,
  emitTriggeredGameMasterTurn,
  handleInvalidGameMasterOutput,
} from './run-game-master.events.js'
import type { ModelConfig } from '../../../domain/model-config/index.js'
import type { LlmAdapterRegistry } from '../../../infrastructure/llm/llm-adapter-registry.js'
import { selectExchangeMessageWindow } from '../../services/conversation-exchange-window.js'
import { TypedRetrievalService } from '../../services/knowledge/typed-retrieval.service.js'
import {
  buildGameMasterTypedRetrievalQueries,
  flattenTypedRetrievalQueries,
} from '../../services/knowledge/typed-retrieval-query-builder.js'

const DEFAULT_GAME_MASTER_STATE: GameMasterState = {
  progression: '',
  interactionCount: 0,
}
const GM_RECENT_EXCHANGE_LIMIT = 3

type ScenarioContext = Pick<ContextScenarioSnapshot, 'description' | 'goals'> & {
  modelSelection?: Scenario['modelSelection']
}

type AvatarRoutingResult = {
  switchedAvatarId?: string
}

export type RunGameMasterOptions = {
  scenarioRepository?: IScenarioRepository
  eventLogRepository?: IEventLogRepository
  messageRepository?: IMessageRepository
  sessionEventPublisher?: ISessionEventPublisher
  memorySelectionService?: MemorySelectionService
  typedRetrievalService?: TypedRetrievalService
  modelConfigRepository?: IModelConfigRepository
  llmAdapterRegistry?: LlmAdapterRegistry
  modelConfigFallback?: ModelConfig
}

export class RunGameMasterUseCase {
  constructor(
    private readonly gmStateRepository: IGmStateRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly avatarRepository: IAvatarRepository,
    private readonly llm: ILlmAdapter,
    private readonly observability: IObservabilityAdapter,
    private readonly options: RunGameMasterOptions = {},
  ) {}

  async execute(input: RunGameMasterInput): Promise<void> {
    let success = true
    this.options.sessionEventPublisher?.setProcessing(input.sessionId, true)
    this.emitRuntimeEvent({
      sessionId: input.sessionId,
      type: 'runtime.processing_started',
      correlationId: input.correlationId,
      payload: { triggerReason: 'post_turn_observation', turnIndex: input.turnIndex },
    })

    const gmRunStartMs = Date.now()
    try {
      const currentState = await this.loadCurrentState(input.sessionId)
      const scenarioContext = await this.loadScenarioContext(input.scenarioId)
      const session = await this.loadSession(input.sessionId)
      const scenarioAvatars = await this.avatarRepository.listByScenarioId(input.scenarioId)

      await this.handleTriggeredTurn(
        input,
        currentState,
        scenarioContext,
        session,
        scenarioAvatars,
        gmRunStartMs,
      )
    } catch (error: unknown) {
      success = false
      throw error
    } finally {
      this.options.sessionEventPublisher?.setProcessing(input.sessionId, false)
      this.emitRuntimeEvent({
        sessionId: input.sessionId,
        type: 'runtime.processing_finished',
        correlationId: input.correlationId,
        payload: { success },
      })
    }
  }

  private async handleTriggeredTurn(
    input: RunGameMasterInput,
    currentState: GameMasterState,
    scenarioContext: ScenarioContext,
    session: Session | null,
    scenarioAvatars: AvatarConfig[],
    gmRunStartMs: number,
  ): Promise<void> {
    const { gmInput, assembledGmContext } = await this.buildGameMasterInput(
      input,
      currentState,
      scenarioContext,
      session,
      scenarioAvatars,
    )
    const llmStart = Date.now()
    const triggerReason = 'post_turn_observation'

    const llmCallResult = await this.callLlm(
      gmInput,
      input,
      currentState,
      scenarioContext,
      triggerReason,
      llmStart,
      gmRunStartMs,
    )
    if (llmCallResult === null) return

    const { llmRequest, llmResponse, llmLatencyMs } = llmCallResult

    const normalizedOutput = await this.parseAndNormalizeOutput({
      input,
      currentState,
      triggerReason,
      llmRequest,
      llmResponse,
      llmStart,
      gmRunStartMs,
      scenarioAvatars,
    })
    if (normalizedOutput === null) {
      return
    }

    const unlockResult = await this.applyAvatarUnlocks(
      input,
      session,
      scenarioAvatars,
      normalizedOutput,
      gmInput.recentMessages,
    )
    const routingResult = await this.applyAvatarRoutingUpdates(
      input,
      session,
      scenarioAvatars,
      normalizedOutput,
      unlockResult,
    )
    const effectiveOutput: GameMasterOutput = {
      ...normalizedOutput,
      ...(routingResult.routing !== undefined ? { routing: routingResult.routing } : {}),
    }
    const nextState = reduceGmState(currentState, {
      progressionUpdate: effectiveOutput.progressionUpdate,
    })
    this.publishDecisionRuntimeEvents(input, effectiveOutput, unlockResult.newlyUnlockedAvatarIds)

    await this.persistGameMasterResult({
      input,
      currentState,
      nextState,
      effectiveOutput,
      switchedAvatarId: routingResult.switchedAvatarId,
      triggerReason,
      gmRunStartMs,
    })

    await emitTriggeredGameMasterTurn({
      input,
      currentState,
      reconciledState: nextState,
      output: effectiveOutput,
      gmContext: assembledGmContext,
      unlockedAvatarIds: unlockResult.newlyUnlockedAvatarIds,
      unlockEvaluations: unlockResult.evaluations,
      ...(routingResult.switchedAvatarId !== undefined
        ? { switchedAvatarId: routingResult.switchedAvatarId }
        : {}),
      triggerReason,
      gmRunStartMs,
      llmStart,
      llmLatencyMs,
      llmRequest,
      llmResponse,
      ...(this.options.eventLogRepository !== undefined
        ? { eventLogRepository: this.options.eventLogRepository }
        : {}),
    })
  }

  private async parseAndNormalizeOutput(args: {
    input: RunGameMasterInput
    currentState: GameMasterState
    triggerReason: string
    llmRequest: { systemPrompt: string; messages: Array<{ role: 'user'; content: string }> }
    llmResponse: LlmResponse
    llmStart: number
    gmRunStartMs: number
    scenarioAvatars: AvatarConfig[]
  }): Promise<GameMasterOutput | null> {
    const parsed = safeParseGameMasterOutput(args.llmResponse.content)
    if (parsed !== null) {
      return normalizeGameMasterOutput(parsed, args.scenarioAvatars)
    }

    await handleInvalidGameMasterOutput({
      input: args.input,
      currentState: args.currentState,
      triggerReason: args.triggerReason,
      llmRequest: args.llmRequest,
      llmResponse: args.llmResponse,
      llmStart: args.llmStart,
      gmRunStartMs: args.gmRunStartMs,
      observability: this.observability,
      ...(this.options.eventLogRepository !== undefined
        ? { eventLogRepository: this.options.eventLogRepository }
        : {}),
    })
    return null
  }

  private async callLlm(
    gmInput: GameMasterInput,
    input: RunGameMasterInput,
    currentState: GameMasterState,
    scenarioContext: ScenarioContext,
    triggerReason: string,
    llmStart: number,
    gmRunStartMs: number,
  ): Promise<{
    llmRequest: {
      systemPrompt: string
      messages: Array<{ role: 'user'; content: string }>
    }
    llmResponse: LlmResponse
    llmLatencyMs: number
  } | null> {
    const resolvedLlm = await this.resolveGameMasterLlmCall(scenarioContext.modelSelection)
    const gmTraceRequestId = `gm_${crypto.randomUUID()}`
    const llmRequest = {
      systemPrompt: buildGameMasterSystemPrompt({
        activeAvatarCount: gmInput.context.availableAvatars.length,
        hasLockedAvatars: gmInput.context.availableAvatars.some(
          (avatar) => avatar.availability === 'locked',
        ),
      }),
      messages: [{ role: 'user' as const, content: renderGameMasterInputForLlm(gmInput) }],
      ...(resolvedLlm.model !== undefined ? { model: resolvedLlm.model } : {}),
      trace: {
        requestId: gmTraceRequestId,
        sessionId: input.sessionId,
        event: 'gm.llm_completion',
        errorEvent: 'gm.llm_error',
        metadata: {
          correlationId: input.correlationId,
          triggerReason,
          conversationId: input.conversationId,
          turnIndex: input.turnIndex,
          effectiveProvider: resolvedLlm.provider,
          effectiveModel: resolvedLlm.effectiveModel,
          gmSystemPromptVersion: GAME_MASTER_SYSTEM_PROMPT_VERSION,
          gmInputRendererVersion: GAME_MASTER_INPUT_RENDERER_VERSION,
        },
      },
    }

    try {
      logResolvedLlmCall({
        role: 'gameMaster',
        effectiveProvider: resolvedLlm.provider,
        effectiveModel: resolvedLlm.effectiveModel,
      })
      const llmCallStart = Date.now()
      const llmResponse = await resolvedLlm.adapter.complete(llmRequest)
      return { llmRequest, llmResponse, llmLatencyMs: Date.now() - llmCallStart }
    } catch (err: unknown) {
      console.error('[GM] LLM call failed:', err)
      await emitGameMasterError(this.options.eventLogRepository, {
        input,
        currentState,
        triggerReason,
        latencyMs: Date.now() - gmRunStartMs,
        errorCode: 'llm_error',
      })
      return null
    }
  }

  private async resolveGameMasterLlmCall(
    scenarioModelSelection: Scenario['modelSelection'],
  ): Promise<{
    adapter: ILlmAdapter
    provider: string
    model?: string
    effectiveModel: string
  }> {
    return await resolveRoleLlmCall({
      role: 'gameMaster',
      legacyAdapter: this.llm,
      modelConfigRepository: this.options.modelConfigRepository,
      llmAdapterRegistry: this.options.llmAdapterRegistry,
      modelConfigFallback: this.options.modelConfigFallback,
      avatarOverride: undefined,
      scenarioModelSelection,
    })
  }

  private async loadCurrentState(sessionId: string): Promise<GameMasterState> {
    return (
      (await this.gmStateRepository.findBySessionId(sessionId)) ?? { ...DEFAULT_GAME_MASTER_STATE }
    )
  }

  private async loadSession(sessionId: string): Promise<Session | null> {
    try {
      return await this.sessionRepository.findById(sessionId)
    } catch (err: unknown) {
      console.error('[GM] Failed to load session for unlock evaluation:', err)
      return null
    }
  }

  private async buildGameMasterInput(
    input: RunGameMasterInput,
    currentState: GameMasterState,
    scenarioContext: ScenarioContext,
    session: Session | null,
    scenarioAvatars: AvatarConfig[],
  ): Promise<{
    gmInput: GameMasterInput
    assembledGmContext: ReturnType<typeof buildGmContextSnapshot>
  }> {
    const { memory, workingMemoryUpdatedAt } = await this.loadMemoryContext(input, session)
    const recentMessages = await this.loadRecentMessages(
      input.conversationId,
      workingMemoryUpdatedAt,
    )
    const retrieval = await this.loadTypedRetrieval(
      input,
      session,
      scenarioContext.description,
      recentMessages,
      memory,
    )
    const assembledGmContext = buildGmContextSnapshot({
      session,
      currentState,
      scenarioAvatars,
      scenarioContext,
      recentMessages,
      memory,
      retrieval,
      userPersona: input.userPersona ?? null,
    })
    const context: GameMasterInput['context'] = {
      experience: {
        scenarioId: input.scenarioId,
        ...(assembledGmContext.sections.worldContext.description !== undefined
          ? { description: assembledGmContext.sections.worldContext.description }
          : {}),
        ...(assembledGmContext.sections.worldContext.goals !== undefined
          ? { goals: assembledGmContext.sections.worldContext.goals }
          : {}),
      },
      availableAvatars: assembledGmContext.availableAvatars,
    }
    if (memory !== undefined) {
      context.memory = memory
    }
    const rag = toGameMasterRagContext(assembledGmContext.sections.retrievedContext)
    if (rag !== undefined) {
      context.rag = rag
    }
    if (assembledGmContext.sections.userPersona !== null) {
      context.userPersona = assembledGmContext.sections.userPersona
    }

    return {
      assembledGmContext,
      gmInput: {
        session: {
          sessionId: input.sessionId,
          turnIndex: input.turnIndex,
          activeAvatarId: input.avatarId,
        },
        userMessage: { text: input.userMessageText },
        ...(assembledGmContext.sections.conversationState.recentMessages.length > 0
          ? { recentMessages: assembledGmContext.sections.conversationState.recentMessages }
          : {}),
        state: currentState,
        context,
      },
    }
  }

  private async loadMemoryContext(
    input: RunGameMasterInput,
    session: Session | null,
  ): Promise<{
    memory: GameMasterInput['context']['memory'] | undefined
    workingMemoryUpdatedAt: string | undefined
  }> {
    if (input.selectedMemory !== undefined) {
      return {
        memory: toGameMasterMemoryContext(input.selectedMemory),
        workingMemoryUpdatedAt: input.selectedMemory.workingMemory?.updatedAt,
      }
    }
    if (
      session === null ||
      input.conversationId === undefined ||
      this.options.messageRepository === undefined
    ) {
      return { memory: undefined, workingMemoryUpdatedAt: undefined }
    }
    const memorySelectionService = this.getMemorySelectionService()
    if (memorySelectionService === undefined) {
      return { memory: undefined, workingMemoryUpdatedAt: undefined }
    }
    try {
      const selectedMemory = await memorySelectionService.select({
        conversationId: input.conversationId,
        userId: session.userId,
        avatarId: input.avatarId,
        scenarioId: input.scenarioId,
        userMessageText: input.userMessageText,
      })
      return {
        memory: memorySelectionService.toGameMasterMemoryContext(selectedMemory),
        workingMemoryUpdatedAt: selectedMemory.workingMemory?.updatedAt,
      }
    } catch {
      return { memory: undefined, workingMemoryUpdatedAt: undefined }
    }
  }

  private async loadRecentMessages(
    conversationId: string | undefined,
    workingMemoryUpdatedAt?: string,
  ): Promise<Array<{ role: 'user' | 'avatar' | 'system'; content: string }>> {
    if (conversationId === undefined || this.options.messageRepository === undefined) return []
    const messages = await this.options.messageRepository.findByConversationId(conversationId, {
      limit: GM_RECENT_EXCHANGE_LIMIT * 2,
    })
    return selectExchangeMessageWindow(messages, workingMemoryUpdatedAt, 0).slice(
      -GM_RECENT_EXCHANGE_LIMIT * 2,
    )
  }

  private getMemorySelectionService(): MemorySelectionService | undefined {
    if (this.options.memorySelectionService !== undefined) {
      return this.options.memorySelectionService
    }
    if (this.options.messageRepository === undefined) return undefined
    return new MemorySelectionService(this.options.messageRepository)
  }

  private async persistTriggeredNotes(sessionId: string, output: GameMasterOutput): Promise<void> {
    if (!hasText(output.directorNotes)) return
    await this.sessionRepository.update(sessionId, { gmNotes: output.directorNotes.trim() })
  }

  private async persistGameMasterResult(args: {
    input: RunGameMasterInput
    currentState: GameMasterState
    nextState: GameMasterState
    effectiveOutput: GameMasterOutput
    switchedAvatarId: string | undefined
    triggerReason: string
    gmRunStartMs: number
  }): Promise<void> {
    try {
      await this.gmStateRepository.save(args.input.sessionId, {
        ...args.nextState,
        nextTurnOrchestration: this.buildNextTurnOrchestration(
          args.input,
          args.effectiveOutput,
          args.switchedAvatarId,
        ),
      })
      await this.persistTriggeredNotes(args.input.sessionId, args.effectiveOutput)
    } catch (error: unknown) {
      console.error('[GM] State persistence failed:', error)
      await emitGameMasterError(this.options.eventLogRepository, {
        input: args.input,
        currentState: args.currentState,
        triggerReason: args.triggerReason,
        latencyMs: Date.now() - args.gmRunStartMs,
        errorCode: 'persistence_error',
      })
      throw error
    }
  }

  // eslint-disable-next-line complexity
  private async applyAvatarRoutingUpdates(
    input: RunGameMasterInput,
    session: Session | null,
    scenarioAvatars: AvatarConfig[],
    output: GameMasterOutput,
    unlockResult: { newlyUnlockedAvatarIds: string[]; evaluations: UnlockEvaluation[] },
  ): Promise<AvatarRoutingResult & { routing?: GameMasterOutput['routing'] }> {
    const routing = output.routing
    if (routing === undefined) return {}
    if (routing.action === 'stay') return { routing }

    const activeAvatarIds = new Set(
      scenarioAvatars
        .filter((avatar) => avatar.status === 'active')
        .map((avatar) => avatar.avatarId),
    )
    const unlockedAvatarIds = new Set([
      ...(session?.unlockedAvatarIds ?? scenarioAvatars.map((avatar) => avatar.avatarId)),
      ...unlockResult.newlyUnlockedAvatarIds,
    ])
    const targetAvatarId = routing.avatarId

    if (
      (routing.action === 'suggest' || routing.action === 'switch') &&
      targetAvatarId !== undefined &&
      activeAvatarIds.has(targetAvatarId) &&
      unlockedAvatarIds.has(targetAvatarId)
    ) {
      if (routing.action === 'switch') {
        await this.sessionRepository.update(input.sessionId, { activeAvatarId: targetAvatarId })
        return { switchedAvatarId: targetAvatarId, routing }
      }
      return { routing }
    }

    if (routing.action === 'unlock_and_switch' && targetAvatarId !== undefined) {
      const wasLocked = session?.unlockedAvatarIds?.includes(targetAvatarId) !== true
      const wasUnlocked = unlockResult.newlyUnlockedAvatarIds.includes(targetAvatarId)
      if (activeAvatarIds.has(targetAvatarId) && wasLocked && wasUnlocked) {
        await this.sessionRepository.update(input.sessionId, { activeAvatarId: targetAvatarId })
        return { switchedAvatarId: targetAvatarId, routing }
      }
    }

    if (
      routing.action === 'unlock' &&
      unlockResult.evaluations.length > 0 &&
      unlockResult.evaluations.some((evaluation) => evaluation.outcome === 'unlocked')
    ) {
      return { routing }
    }

    return { routing: { action: 'stay' } }
  }

  private buildNextTurnOrchestration(
    input: RunGameMasterInput,
    output: GameMasterOutput,
    switchedAvatarId: string | undefined,
  ): GameMasterOrchestrationState {
    return {
      generatedByCorrelationId: input.correlationId,
      activeAvatarId: switchedAvatarId ?? input.avatarId,
      generatedAfterTurn: input.turnIndex,
      generatedAt: new Date().toISOString(),
      dialogueControl: output.dialogueControl,
      retrievalPlan: output.retrievalPlan,
      directorNotes: output.directorNotes,
      ...(output.routing !== undefined ? { routing: output.routing } : {}),
      progressionUpdate: output.progressionUpdate,
    }
  }

  private async applyAvatarUnlocks(
    input: RunGameMasterInput,
    session: Session | null,
    scenarioAvatars: AvatarConfig[],
    output: GameMasterOutput,
    recentMessages: GameMasterInput['recentMessages'],
  ): Promise<{ newlyUnlockedAvatarIds: string[]; evaluations: UnlockEvaluation[] }> {
    const unlocks = resolveAvatarUnlocks(session, scenarioAvatars, output, recentMessages)
    if (unlocks === null) {
      return {
        newlyUnlockedAvatarIds: [],
        evaluations: [],
      }
    }

    if (unlocks.newlyUnlockedAvatarIds.length > 0) {
      await this.sessionRepository.update(input.sessionId, {
        unlockedAvatarIds: unlocks.nextUnlockedAvatarIds,
      })
    }
    return {
      newlyUnlockedAvatarIds: unlocks.newlyUnlockedAvatarIds,
      evaluations: unlocks.evaluations,
    }
  }

  private async loadScenarioContext(scenarioId: string): Promise<ScenarioContext> {
    if (this.options.scenarioRepository === undefined) {
      return {}
    }
    const scenario = await this.options.scenarioRepository.findById(scenarioId)
    if (scenario === null) {
      return {}
    }
    const goals = [
      ...scenario.objectives,
      ...(Array.isArray(scenario.config.goals) ? scenario.config.goals : []),
    ]
    return {
      ...(hasText(scenario.worldContext) ? { description: scenario.worldContext } : {}),
      ...(goals.length > 0 ? { goals } : {}),
      ...(scenario.modelSelection !== undefined ? { modelSelection: scenario.modelSelection } : {}),
    }
  }

  private publishDecisionRuntimeEvents(
    input: RunGameMasterInput,
    output: GameMasterOutput,
    unlockedAvatarIds: string[],
  ): void {
    const baseFields = {
      sessionId: input.sessionId,
      ...(input.conversationId !== undefined ? { conversationId: input.conversationId } : {}),
      correlationId: input.correlationId,
    }

    if (unlockedAvatarIds.length > 0) {
      this.emitRuntimeEvent({
        ...baseFields,
        type: 'runtime.avatar_unlocked',
        payload: { unlockedAvatarIds },
      })
    }

    if (output.routing?.action === 'suggest' && output.routing.avatarId !== undefined) {
      this.emitRuntimeEvent({
        ...baseFields,
        type: 'runtime.avatar_suggested',
        payload: {
          suggestedAvatarId: output.routing.avatarId,
          ...(output.routing.reason !== undefined ? { reason: output.routing.reason } : {}),
        },
      })
    }
  }

  private emitRuntimeEvent(fields: Omit<RuntimeEvent, 'eventId' | 'occurredAt'>): void {
    if (this.options.sessionEventPublisher === undefined) return
    try {
      const event: RuntimeEvent = {
        eventId: `rev_${crypto.randomUUID()}`,
        occurredAt: new Date().toISOString(),
        ...fields,
      }
      this.options.sessionEventPublisher.emit(event)
    } catch (error: unknown) {
      console.warn('[GM] Runtime event emission failed:', error)
    }
  }

  private async loadTypedRetrieval(
    input: RunGameMasterInput,
    session: Session | null,
    worldContext: string | undefined,
    recentMessages: Array<{ role: 'user' | 'avatar' | 'system'; content: string }>,
    memory: GameMasterInput['context']['memory'] | undefined,
  ) {
    if (
      this.options.typedRetrievalService === undefined ||
      session === null ||
      input.conversationId === undefined
    ) {
      return undefined
    }

    const queries = buildGameMasterTypedRetrievalQueries({
      worldContext,
      recentExchanges: toRecentExchanges(recentMessages),
      workingMemorySummary: memory?.workingMemory?.summary,
    })
    const query = flattenTypedRetrievalQueries(queries)
    if (!hasText(query)) return undefined

    return this.options.typedRetrievalService.retrieve({
      scenarioId: input.scenarioId,
      sessionId: input.sessionId,
      userId: session.userId,
      conversationId: input.conversationId,
      bypassVisibilityFilter: true,
      query,
      queries,
      limitPerType: 3,
    })
  }
}

function toGameMasterRagContext(
  knowledge:
    | {
        memory: Array<{ sourceId: string; content: string }>
        world: Array<{ sourceId: string; content: string }>
        media: Array<{ sourceId: string; content: string }>
      }
    | undefined,
): GameMasterInput['context']['rag'] | undefined {
  if (knowledge === undefined) return undefined

  const rag = {
    ...(knowledge.memory.length > 0 ? { memory: toRagEntries(knowledge.memory) } : {}),
    ...(knowledge.world.length > 0 ? { world: toRagEntries(knowledge.world) } : {}),
    ...(knowledge.media.length > 0 ? { media: toRagEntries(knowledge.media) } : {}),
  }

  return Object.keys(rag).length > 0 ? rag : undefined
}

function toRagEntries(items: Array<{ sourceId: string; content: string }>) {
  return items.map((item) => ({
    sourceId: item.sourceId,
    excerpt: item.content,
  }))
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function toRecentExchanges(
  recentMessages: Array<{ role: 'user' | 'avatar' | 'system'; content: string }>,
): Array<{ user: string; avatar: string }> {
  const exchanges: Array<{ user: string; avatar: string }> = []
  let pendingUser: string | undefined

  for (const message of recentMessages) {
    if (message.role === 'user') {
      pendingUser = message.content
      continue
    }
    if (message.role === 'avatar' && pendingUser !== undefined) {
      exchanges.push({ user: pendingUser, avatar: message.content })
      pendingUser = undefined
    }
  }

  return exchanges
}

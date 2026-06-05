/* eslint-disable max-lines */
import crypto from 'node:crypto'
import type { RuntimeEvent } from '@gami/shared'
import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
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
import { ContextEngine } from '../../../domain/context/context-engine.service.js'
import type { ContextScenarioSnapshot } from '../../../domain/context/session-context.types.js'
import { buildGameMasterSystemPrompt } from '../../../domain/game-master/gm-prompt.service.js'
import { reduceGmState } from '../../../domain/game-master/gm-state-reducer.js'
import type {
  GameMasterInput,
  GameMasterOutput,
  GameMasterState,
} from '../../../domain/game-master/game-master.types.js'
import type { Session } from '../../../domain/conversation/session.types.js'
import type { RunGameMasterInput } from './run-game-master.types.js'
import { MemorySelectionService } from '../../services/memory-selection.service.js'
import {
  logResolvedLlmCall,
  resolveRoleLlmCall,
} from '../../services/model-resolution-runtime.service.js'
import { safeParseGameMasterOutput } from './run-game-master.helpers.js'
import {
  normalizeGameMasterOutput,
  toRecentExchangeMessages,
} from './run-game-master.normalization.js'
import { type UnlockEvaluation, resolveAvatarUnlocks } from './run-game-master.avatar-unlocks.js'
import { resolveAssembledGmContext } from './run-game-master.context-engine.js'
import {
  emitGameMasterError,
  emitTriggeredGameMasterTurn,
  handleInvalidGameMasterOutput,
  incrementInteractionAndSave,
} from './run-game-master.events.js'
import type { ModelConfig } from '../../../domain/model-config/index.js'
import type { LlmAdapterRegistry } from '../../../infrastructure/llm/llm-adapter-registry.js'

const DEFAULT_GAME_MASTER_STATE: GameMasterState = {
  progression: '',
  topicsCovered: [],
  interactionCount: 0,
}
const GM_RECENT_EXCHANGE_LIMIT = 3

type ScenarioContext = Pick<ContextScenarioSnapshot, 'description' | 'goals'>

type AvatarRoutingResult = {
  switchedAvatarId?: string
}

export class RunGameMasterUseCase {
  constructor(
    private readonly gmStateRepository: IGmStateRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly avatarRepository: IAvatarRepository,
    private readonly llm: ILlmAdapter,
    private readonly observability: IObservabilityAdapter,
    private readonly scenarioRepository?: IScenarioRepository,
    private readonly eventLogRepository?: IEventLogRepository,
    private readonly conversationRepository?: IConversationRepository,
    private readonly messageRepository?: IMessageRepository,
    private readonly sessionEventPublisher?: ISessionEventPublisher,
    private readonly memorySelectionService?: MemorySelectionService,
    private readonly contextEngine: ContextEngine = new ContextEngine(),
    private readonly modelConfigRepository?: IModelConfigRepository,
    private readonly llmAdapterRegistry?: LlmAdapterRegistry,
    private readonly modelConfigFallback?: ModelConfig,
  ) {}

  async execute(input: RunGameMasterInput): Promise<void> {
    let success = true
    this.sessionEventPublisher?.setProcessing(input.sessionId, true)
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
      this.sessionEventPublisher?.setProcessing(input.sessionId, false)
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

    const sanitizedStateUpdate = { ...normalizedOutput.stateUpdate }
    if (normalizedOutput.conversationMode === 'new') {
      delete sanitizedStateUpdate.activeAvatarId
    }
    const nextState = reduceGmState(currentState, sanitizedStateUpdate)
    const routingResult = this.applyAvatarRoutingUpdates(
      input,
      currentState,
      session,
      scenarioAvatars,
      normalizedOutput,
    )
    const unlockResult = await this.applyAvatarUnlocks(
      input,
      session,
      scenarioAvatars,
      normalizedOutput,
      gmInput.recentMessages,
    )
    this.publishDecisionRuntimeEvents(input, normalizedOutput, unlockResult.newlyUnlockedAvatarIds)

    const reconciledState: GameMasterState =
      routingResult.switchedAvatarId !== undefined
        ? { ...nextState, currentAvatarId: routingResult.switchedAvatarId }
        : nextState
    await this.gmStateRepository.save(input.sessionId, reconciledState)
    await this.persistTriggeredNotes(input.sessionId, normalizedOutput)

    await emitTriggeredGameMasterTurn({
      input,
      currentState,
      reconciledState,
      output: normalizedOutput,
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
      ...(this.eventLogRepository !== undefined
        ? { eventLogRepository: this.eventLogRepository }
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
    const normalized =
      parsed !== null ? normalizeGameMasterOutput(parsed, args.scenarioAvatars) : null

    if (normalized !== null) return normalized

    await handleInvalidGameMasterOutput({
      input: args.input,
      currentState: args.currentState,
      triggerReason: args.triggerReason,
      llmRequest: args.llmRequest,
      llmResponse: args.llmResponse,
      llmStart: args.llmStart,
      gmRunStartMs: args.gmRunStartMs,
      gmStateRepository: this.gmStateRepository,
      observability: this.observability,
      ...(this.eventLogRepository !== undefined
        ? { eventLogRepository: this.eventLogRepository }
        : {}),
    })
    return null
  }

  private async callLlm(
    gmInput: GameMasterInput,
    input: RunGameMasterInput,
    currentState: GameMasterState,
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
    const resolvedLlm = await this.resolveGameMasterLlmCall()
    const gmTraceRequestId = `gm_${crypto.randomUUID()}`
    const llmRequest = {
      systemPrompt: buildGameMasterSystemPrompt(),
      messages: [{ role: 'user' as const, content: JSON.stringify(gmInput) }],
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
      await incrementInteractionAndSave(this.gmStateRepository, input.sessionId, currentState)
      await emitGameMasterError(this.eventLogRepository, {
        input,
        currentState,
        triggerReason,
        latencyMs: Date.now() - gmRunStartMs,
        errorCode: 'llm_error',
      })
      return null
    }
  }

  private async resolveGameMasterLlmCall(): Promise<{
    adapter: ILlmAdapter
    provider: string
    model?: string
    effectiveModel: string
  }> {
    return await resolveRoleLlmCall({
      role: 'gameMaster',
      legacyAdapter: this.llm,
      modelConfigRepository: this.modelConfigRepository,
      llmAdapterRegistry: this.llmAdapterRegistry,
      modelConfigFallback: this.modelConfigFallback,
      avatarOverride: undefined,
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
    assembledGmContext: ReturnType<typeof resolveAssembledGmContext>
  }> {
    const { memory, workingMemoryUpdatedAt } = await this.loadMemoryContext(input, session)
    const recentMessages = await this.loadRecentMessages(
      input.conversationId,
      workingMemoryUpdatedAt,
    )
    const assembledGmContext = resolveAssembledGmContext({
      input,
      session,
      currentState,
      scenarioAvatars,
      scenarioContext,
      recentMessages,
      contextEngine: this.contextEngine,
      memorySelectionService: this.getMemorySelectionServiceForFallback(),
    })

    return {
      assembledGmContext,
      gmInput: {
        session: { sessionId: input.sessionId, turnIndex: input.turnIndex },
        userMessage: { text: input.userMessageText },
        ...(assembledGmContext.recentMessages.length > 0
          ? { recentMessages: assembledGmContext.recentMessages }
          : {}),
        state: currentState,
        context: {
          experience: {
            scenarioId: input.scenarioId,
            ...(assembledGmContext.scenario.description !== undefined
              ? { description: assembledGmContext.scenario.description }
              : {}),
            ...(assembledGmContext.scenario.goals !== undefined
              ? { goals: assembledGmContext.scenario.goals }
              : {}),
          },
          ...(memory !== undefined ? { memory } : {}),
          ...(() => {
            const rag = toGameMasterRagContext(assembledGmContext.knowledge)
            return rag !== undefined ? { rag } : {}
          })(),
          ...(assembledGmContext.userPersona !== null
            ? { userPersona: assembledGmContext.userPersona }
            : {}),
          availableAvatars: assembledGmContext.availableAvatars,
        },
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
        memory: this.getMemorySelectionServiceForFallback().toGameMasterMemoryContext(
          input.selectedMemory,
        ),
        workingMemoryUpdatedAt: input.selectedMemory.workingMemory?.updatedAt,
      }
    }
    if (
      session === null ||
      input.conversationId === undefined ||
      this.messageRepository === undefined
    ) {
      return { memory: undefined, workingMemoryUpdatedAt: undefined }
    }
    try {
      const selectedMemory = await this.getMemorySelectionService().select({
        conversationId: input.conversationId,
        userId: session.userId,
        avatarId: input.avatarId,
        scenarioId: input.scenarioId,
        userMessageText: input.userMessageText,
      })
      return {
        memory: this.getMemorySelectionService().toGameMasterMemoryContext(selectedMemory),
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
    if (conversationId === undefined || this.messageRepository === undefined) return []
    const messages = await this.messageRepository.findByConversationId(conversationId, {
      limit: 24,
    })
    const sorted = messages
      .slice()
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))

    // When working memory exists, only send exchanges not yet covered by it.
    // Always guarantee at least 1 full exchange so the GM has immediate context.
    const memoryThresholdMs =
      workingMemoryUpdatedAt !== undefined ? Date.parse(workingMemoryUpdatedAt) : undefined
    const uncovered =
      memoryThresholdMs !== undefined
        ? sorted.filter((m) => Date.parse(m.createdAt) > memoryThresholdMs)
        : sorted

    const exchanges = toRecentExchangeMessages(
      uncovered.map((m) => ({ role: m.role, content: m.content })),
      GM_RECENT_EXCHANGE_LIMIT,
    )

    // Fallback: if no complete exchange in uncovered window, include at least the last one
    if (exchanges.length === 0 && sorted.length > 0) {
      return toRecentExchangeMessages(
        sorted.map((m) => ({ role: m.role, content: m.content })),
        1,
      )
    }

    return exchanges
  }

  private getMemorySelectionService(): MemorySelectionService {
    return (
      this.memorySelectionService ??
      new MemorySelectionService(
        this.messageRepository as IMessageRepository,
        undefined,
        undefined,
        undefined,
      )
    )
  }

  private getMemorySelectionServiceForFallback(): MemorySelectionService {
    return (
      this.memorySelectionService ??
      new MemorySelectionService(
        {
          save: () => Promise.reject(new Error('not_implemented')),
          findByConversationId: () => Promise.resolve([]),
          deleteByConversationId: () => Promise.resolve(0),
        } satisfies IMessageRepository,
        undefined,
        undefined,
        undefined,
      )
    )
  }

  private async persistTriggeredNotes(sessionId: string, output: GameMasterOutput): Promise<void> {
    if (!hasText(output.context?.notes)) return
    await this.sessionRepository.update(sessionId, { gmNotes: output.context.notes.trim() })
  }

  private applyAvatarRoutingUpdates(
    _input: RunGameMasterInput,
    _currentState: GameMasterState,
    _session: Session | null,
    _scenarioAvatars: AvatarConfig[],
    _output: GameMasterOutput,
  ): AvatarRoutingResult {
    return {}
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
    if (this.scenarioRepository === undefined) {
      return {}
    }
    const scenario = await this.scenarioRepository.findById(scenarioId)
    if (scenario === null) {
      return {}
    }
    const goals = [
      ...(Array.isArray(scenario.config.objectives) ? scenario.config.objectives : []),
      ...(Array.isArray(scenario.config.goals) ? scenario.config.goals : []),
    ]
    return {
      ...(hasText(scenario.config.worldContext)
        ? { description: scenario.config.worldContext }
        : {}),
      ...(goals.length > 0 ? { goals } : {}),
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

    if (output.suggestedAvatarId !== undefined) {
      this.emitRuntimeEvent({
        ...baseFields,
        type: 'runtime.avatar_suggested',
        payload: {
          suggestedAvatarId: output.suggestedAvatarId,
          ...(output.suggestedAvatarReason !== undefined
            ? { reason: output.suggestedAvatarReason }
            : {}),
        },
      })
    }

    if (output.recommendedChoices !== undefined && output.recommendedChoices.length > 0) {
      this.emitRuntimeEvent({
        ...baseFields,
        type: 'runtime.choice_required',
        payload: { choices: output.recommendedChoices },
      })
    }
  }

  private emitRuntimeEvent(fields: Omit<RuntimeEvent, 'eventId' | 'occurredAt'>): void {
    if (this.sessionEventPublisher === undefined) return
    try {
      const event: RuntimeEvent = {
        eventId: `rev_${crypto.randomUUID()}`,
        occurredAt: new Date().toISOString(),
        ...fields,
      }
      this.sessionEventPublisher.emit(event)
    } catch (error: unknown) {
      console.warn('[GM] Runtime event emission failed:', error)
    }
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

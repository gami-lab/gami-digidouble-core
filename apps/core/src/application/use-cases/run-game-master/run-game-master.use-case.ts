import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'
import type { IGmStateRepository } from '../../ports/IGmStateRepository.js'
import type { ILlmAdapter, LlmResponse } from '../../ports/ILlmAdapter.js'
import type { IMessageRepository } from '../../ports/IMessageRepository.js'
import type { IObservabilityAdapter } from '../../ports/IObservabilityAdapter.js'
import type { IModelConfigRepository } from '../../ports/IModelConfigRepository.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { ISessionEventPublisher } from '../../ports/ISessionEventPublisher.js'
import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { MemorySelectionService } from '../../services/memory-selection.service.js'
import type { TypedRetrievalService } from '../../services/knowledge/typed-retrieval.service.js'
import type { MediaCueService } from '../../services/media/media-cue.service.js'
import type { IMediaAssetRepository } from '../../ports/IMediaAssetRepository.js'
import { emitTriggeredMediaCues, loadMediaCatalogue } from './run-game-master.media-cues.js'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
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
  GameMasterOutput,
  GameMasterState,
} from '../../../domain/game-master/game-master.types.js'
import type { Session } from '../../../domain/conversation/session.types.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'
import type { RunGameMasterInput } from './run-game-master.types.js'
import {
  logResolvedLlmCall,
  resolveRoleLlmCall,
} from '../../services/model-resolution-runtime.service.js'
import { type UnlockEvaluation, resolveAvatarUnlocks } from './run-game-master.avatar-unlocks.js'
import {
  buildGameMasterInput,
  loadGameMasterScenarioContext,
  type GameMasterScenarioContext,
} from './run-game-master.context.js'
import {
  emitGameMasterError,
  emitRuntimeEvent,
  publishDecisionRuntimeEvents,
  gameMasterLlmTraceId,
  emitTriggeredGameMasterTurn,
  handleInvalidGameMasterOutput,
} from './run-game-master.events.js'
import type { ModelConfig } from '../../../domain/model-config/index.js'
import type { LlmAdapterRegistry } from '../../../infrastructure/llm/llm-adapter-registry.js'
import { persistGameMasterResult } from './run-game-master.persistence.js'
import { applyAvatarRoutingUpdates, type AvatarRoutingResult } from './run-game-master.routing.js'

const DEFAULT_GAME_MASTER_STATE: GameMasterState = {
  progression: '',
  interactionCount: 0,
}
const GAME_MASTER_RESPONSE_MAX_TOKENS = 2048

type AvatarUnlockResult = {
  newlyUnlockedAvatarIds: string[]
  evaluations: UnlockEvaluation[]
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
  mediaCueService?: MediaCueService
  mediaAssetRepository?: IMediaAssetRepository
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
    emitRuntimeEvent(this.options.sessionEventPublisher, {
      sessionId: input.sessionId,
      type: 'runtime.processing_started',
      correlationId: input.correlationId,
      payload: { triggerReason: 'post_turn_observation', turnIndex: input.turnIndex },
    })

    const gmRunStartMs = Date.now()
    try {
      const currentState = await this.loadCurrentState(input.sessionId)
      const scenarioContext = await loadGameMasterScenarioContext(
        this.options.scenarioRepository,
        input.scenarioId,
      )
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
      emitRuntimeEvent(this.options.sessionEventPublisher, {
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
    scenarioContext: GameMasterScenarioContext,
    session: Session | null,
    scenarioAvatars: AvatarConfig[],
    gmRunStartMs: number,
  ): Promise<void> {
    const { gmInput, assembledGmContext } = await buildGameMasterInput({
      input,
      currentState,
      scenarioContext,
      session,
      scenarioAvatars,
      mediaCatalogue: await loadMediaCatalogue(
        this.options.mediaAssetRepository,
        this.options.eventLogRepository,
        input,
      ),
      dependencies: {
        ...(this.options.messageRepository !== undefined
          ? { messageRepository: this.options.messageRepository }
          : {}),
        ...(this.options.memorySelectionService !== undefined
          ? { memorySelectionService: this.options.memorySelectionService }
          : {}),
        ...(this.options.typedRetrievalService !== undefined
          ? { typedRetrievalService: this.options.typedRetrievalService }
          : {}),
      },
    })
    const llmStart = Date.now()
    const triggerReason = 'post_turn_observation'

    const llmCallResult = await this.callLlm(
      gmInput,
      input,
      currentState,
      scenarioContext,
      triggerReason,
      gmRunStartMs,
      session?.modelOverride,
    )
    if (llmCallResult === null) return

    const { llmResponse, llmLatencyMs, llmProvider } = llmCallResult

    const parsedOutput = await this.parseAndNormalizeOutput({
      input,
      currentState,
      triggerReason,
      llmResponse,
      llmProvider,
      llmStart,
      gmRunStartMs,
      scenarioAvatars,
      mediaCatalogue: gmInput.context.mediaCatalogue ?? [],
    })
    if (parsedOutput === null) {
      return
    }
    const { normalizedOutput, requestedMediaCue } = parsedOutput

    const unlockResult = await this.applyAvatarUnlocks(
      input,
      session,
      scenarioAvatars,
      normalizedOutput,
      gmInput.context.conversationState.recentMessages,
    )
    const routingResult = await applyAvatarRoutingUpdates({
      sessionRepository: this.sessionRepository,
      input,
      session,
      scenarioAvatars,
      output: normalizedOutput,
      unlockResult,
    })
    const effectiveOutput: GameMasterOutput = {
      ...normalizedOutput,
      ...(routingResult.routing !== undefined ? { routing: routingResult.routing } : {}),
    }
    const nextState = reduceGmState(currentState, {
      progressionUpdate: effectiveOutput.progressionUpdate,
    })
    await this.persistAndEmitTurn({
      input,
      scenarioAvatars,
      currentState,
      nextState,
      effectiveOutput,
      assembledGmContext,
      unlockResult,
      routingResult,
      triggerReason,
      gmRunStartMs,
      llmStart,
      llmLatencyMs,
      llmResponse,
      llmProvider,
      requestedMediaCue,
    })
  }

  private async persistAndEmitTurn(args: {
    input: RunGameMasterInput
    scenarioAvatars: AvatarConfig[]
    currentState: GameMasterState
    nextState: GameMasterState
    effectiveOutput: GameMasterOutput
    assembledGmContext: Awaited<ReturnType<typeof buildGameMasterInput>>['assembledGmContext']
    unlockResult: AvatarUnlockResult
    routingResult: AvatarRoutingResult
    triggerReason: string
    gmRunStartMs: number
    llmStart: number
    llmLatencyMs: number
    llmResponse: LlmResponse
    llmProvider: string
    requestedMediaCue: GameMasterOutput['mediaCue']
  }): Promise<void> {
    publishDecisionRuntimeEvents(
      this.options.sessionEventPublisher,
      args.input,
      args.effectiveOutput,
      args.unlockResult.newlyUnlockedAvatarIds,
    )
    if (this.options.mediaCueService !== undefined) {
      await emitTriggeredMediaCues(this.options.mediaCueService, {
        input: args.input,
        scenarioAvatars: args.scenarioAvatars,
        unlockedAvatarIds: args.unlockResult.newlyUnlockedAvatarIds,
        switchedAvatarId: args.routingResult.switchedAvatarId,
        mediaCue: args.effectiveOutput.mediaCue,
      })
    }
    await persistGameMasterResult({
      gmStateRepository: this.gmStateRepository,
      sessionRepository: this.sessionRepository,
      ...(this.options.eventLogRepository !== undefined
        ? { eventLogRepository: this.options.eventLogRepository }
        : {}),
      input: args.input,
      currentState: args.currentState,
      nextState: args.nextState,
      effectiveOutput: args.effectiveOutput,
      switchedAvatarId: args.routingResult.switchedAvatarId,
      triggerReason: args.triggerReason,
      gmRunStartMs: args.gmRunStartMs,
    })
    await emitTriggeredGameMasterTurn({
      input: args.input,
      currentState: args.currentState,
      reconciledState: args.nextState,
      output: args.effectiveOutput,
      gmContext: args.assembledGmContext,
      unlockedAvatarIds: args.unlockResult.newlyUnlockedAvatarIds,
      unlockEvaluations: args.unlockResult.evaluations,
      ...(args.routingResult.switchedAvatarId !== undefined
        ? { switchedAvatarId: args.routingResult.switchedAvatarId }
        : {}),
      triggerReason: args.triggerReason,
      gmRunStartMs: args.gmRunStartMs,
      llmStart: args.llmStart,
      llmLatencyMs: args.llmLatencyMs,
      llmResponse: args.llmResponse,
      llmProvider: args.llmProvider,
      requestedMediaCue: args.requestedMediaCue,
      ...(this.options.eventLogRepository !== undefined
        ? { eventLogRepository: this.options.eventLogRepository }
        : {}),
    })
  }

  private async parseAndNormalizeOutput(args: {
    input: RunGameMasterInput
    currentState: GameMasterState
    triggerReason: string
    llmResponse: LlmResponse
    llmProvider: string
    llmStart: number
    gmRunStartMs: number
    scenarioAvatars: AvatarConfig[]
    mediaCatalogue: NonNullable<GameMasterInput['context']['mediaCatalogue']>
  }): Promise<{
    normalizedOutput: GameMasterOutput
    requestedMediaCue: GameMasterOutput['mediaCue']
  } | null> {
    const parsed = safeParseGameMasterOutput(args.llmResponse.content)
    if (parsed !== null) {
      return {
        normalizedOutput: normalizeGameMasterOutput(
          parsed,
          args.scenarioAvatars,
          args.mediaCatalogue,
        ),
        requestedMediaCue: parsed.mediaCue,
      }
    }

    await handleInvalidGameMasterOutput({
      input: args.input,
      currentState: args.currentState,
      triggerReason: args.triggerReason,
      llmResponse: args.llmResponse,
      llmProvider: args.llmProvider,
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
    scenarioContext: GameMasterScenarioContext,
    triggerReason: string,
    gmRunStartMs: number,
    sessionOverride: Session['modelOverride'],
  ): Promise<{
    llmResponse: LlmResponse
    llmLatencyMs: number
    llmProvider: string
  } | null> {
    const resolvedLlm = await this.resolveGameMasterLlmCall(
      scenarioContext.modelSelection,
      sessionOverride,
    )
    const gmTraceRequestId = gameMasterLlmTraceId(input.correlationId)
    const llmRequest = {
      systemPrompt: buildGameMasterSystemPrompt({
        activeAvatarCount: gmInput.context.availableAvatars.length,
        hasLockedAvatars: gmInput.context.availableAvatars.some(
          (avatar) => avatar.availability === 'locked',
        ),
        hasMediaCatalogue: gmInput.context.mediaCatalogue !== undefined,
      }),
      messages: [{ role: 'user' as const, content: renderGameMasterInputForLlm(gmInput) }],
      maxTokens: GAME_MASTER_RESPONSE_MAX_TOKENS,
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
      return {
        llmResponse,
        llmLatencyMs: Date.now() - llmCallStart,
        llmProvider: resolvedLlm.provider,
      }
    } catch (err: unknown) {
      console.error('[GM] LLM call failed:', err)
      await emitGameMasterError(this.options.eventLogRepository, {
        input,
        currentState,
        triggerReason,
        latencyMs: Date.now() - gmRunStartMs,
        errorCode: 'llm_error',
        provider: resolvedLlm.provider,
        model: resolvedLlm.effectiveModel,
      })
      return null
    }
  }

  private async resolveGameMasterLlmCall(
    scenarioModelSelection: Scenario['modelSelection'],
    sessionOverride: Session['modelOverride'],
  ): Promise<{
    adapter: ILlmAdapter
    provider: string
    model?: string
    effectiveModel: string
  }> {
    return await resolveRoleLlmCall({
      role: 'gameMaster',
      defaultAdapter: this.llm,
      modelConfigRepository: this.options.modelConfigRepository,
      llmAdapterRegistry: this.options.llmAdapterRegistry,
      modelConfigFallback: this.options.modelConfigFallback,
      avatarOverride: undefined,
      ...(sessionOverride !== undefined ? { sessionOverride } : {}),
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

  private async applyAvatarUnlocks(
    input: RunGameMasterInput,
    session: Session | null,
    scenarioAvatars: AvatarConfig[],
    output: GameMasterOutput,
    recentMessages: GameMasterInput['context']['conversationState']['recentMessages'],
  ): Promise<AvatarUnlockResult> {
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
}

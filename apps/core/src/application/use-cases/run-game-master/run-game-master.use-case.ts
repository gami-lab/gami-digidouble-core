import crypto from 'node:crypto'
import type { RuntimeEvent } from '@gami/shared'
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
import { buildGameMasterInput, type GameMasterScenarioContext } from './run-game-master.context.js'
import {
  emitGameMasterError,
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
      llmStart,
      gmRunStartMs,
    )
    if (llmCallResult === null) return

    const { llmResponse, llmLatencyMs } = llmCallResult

    const normalizedOutput = await this.parseAndNormalizeOutput({
      input,
      currentState,
      triggerReason,
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
    })
  }

  private async persistAndEmitTurn(args: {
    input: RunGameMasterInput
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
  }): Promise<void> {
    this.publishDecisionRuntimeEvents(
      args.input,
      args.effectiveOutput,
      args.unlockResult.newlyUnlockedAvatarIds,
    )
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
    scenarioContext: GameMasterScenarioContext,
    triggerReason: string,
    llmStart: number,
    gmRunStartMs: number,
  ): Promise<{
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
      return { llmResponse, llmLatencyMs: Date.now() - llmCallStart }
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

  private async applyAvatarUnlocks(
    input: RunGameMasterInput,
    session: Session | null,
    scenarioAvatars: AvatarConfig[],
    output: GameMasterOutput,
    recentMessages: GameMasterInput['recentMessages'],
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

  private async loadScenarioContext(scenarioId: string): Promise<GameMasterScenarioContext> {
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
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

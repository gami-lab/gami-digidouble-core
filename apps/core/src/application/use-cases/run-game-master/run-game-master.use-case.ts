import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { IEventLogRepository, StoredEvent } from '../../ports/IEventLogRepository.js'
import type { IGmStateRepository } from '../../ports/IGmStateRepository.js'
import type { ILlmAdapter, LlmResponse } from '../../ports/ILlmAdapter.js'
import type { IObservabilityAdapter } from '../../ports/IObservabilityAdapter.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type {
  AvatarTransitionRule,
  EligibleTransition,
} from '../../../domain/avatar/avatar-transition.types.js'
import { evaluateTransitionRules } from '../../../domain/avatar/transition-engine.js'
import { buildGameMasterSystemPrompt } from '../../../domain/game-master/gm-prompt.service.js'
import { reduceGmState } from '../../../domain/game-master/gm-state-reducer.js'
import type {
  GameMasterInput,
  GameMasterOutput,
  GameMasterState,
  GameMasterStateSummary,
} from '../../../domain/game-master/game-master.types.js'
import {
  evaluateTriggers,
  type TriggerPolicy,
  type TriggerReason,
} from '../../../domain/game-master/trigger-engine.js'
import type { RunGameMasterInput } from './run-game-master.types.js'
import {
  extractScenarioAvatarTransitionRules,
  extractScenarioPolicy,
  mapTriggerReasonToTransitionTrigger,
  safeParseGameMasterOutput,
} from './run-game-master.helpers.js'

const DEFAULT_GAME_MASTER_STATE: GameMasterState = {
  progression: '',
  topicsCovered: [],
  interactionCount: 0,
}

type ScenarioContext = {
  description?: string
  goals?: string[]
  policy?: TriggerPolicy
  avatarTransitionRules?: AvatarTransitionRule[]
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
  ) {}

  async execute(input: RunGameMasterInput): Promise<void> {
    const gmRunStartMs = Date.now()
    const currentState = await this.loadCurrentState(input.sessionId)
    const scenarioContext = await this.loadScenarioContext(input.scenarioId)
    const triggerReason = evaluateTriggers(currentState, scenarioContext.policy)

    if (triggerReason === null) {
      await this.handleSkippedTurn(input, currentState, gmRunStartMs)
      return
    }

    await this.handleTriggeredTurn(
      input,
      currentState,
      scenarioContext,
      triggerReason,
      gmRunStartMs,
    )
  }

  private async handleTriggeredTurn(
    input: RunGameMasterInput,
    currentState: GameMasterState,
    scenarioContext: ScenarioContext,
    triggerReason: TriggerReason,
    gmRunStartMs: number,
  ): Promise<void> {
    const eligibleTransitions = evaluateTransitionRules(
      currentState.currentAvatarId,
      currentState,
      scenarioContext.avatarTransitionRules ?? [],
      mapTriggerReasonToTransitionTrigger(triggerReason),
    )
    const gmInput = await this.buildGameMasterInput(
      input,
      currentState,
      scenarioContext,
      eligibleTransitions,
    )
    const llmStart = Date.now()

    const llmResponse = await this.callLlm(
      gmInput,
      input,
      currentState,
      triggerReason,
      llmStart,
      gmRunStartMs,
    )
    if (llmResponse === null) return

    const output = safeParseGameMasterOutput(llmResponse.content)
    if (output === null) {
      await this.handleInvalidOutput(
        input,
        currentState,
        triggerReason,
        llmResponse,
        llmStart,
        gmRunStartMs,
      )
      return
    }

    const nextState = reduceGmState(currentState, output.stateUpdate)
    await this.gmStateRepository.save(input.sessionId, nextState)
    await this.persistTriggeredNotes(input.sessionId, output)

    await this.emitEventSafe({
      sessionId: input.sessionId,
      type: 'gm_triggered',
      severity: 'info',
      correlationId: input.correlationId,
      payload: {
        triggerReason,
        turnIndex: input.turnIndex,
        interactionCount: nextState.interactionCount,
        stateBefore: buildStateSummary(currentState),
        decision: {
          avatarId: output.avatarId,
          conversationMode: output.conversationMode,
          notesInjected: Boolean(output.context?.notes),
          directiveCount: output.recommendedChoices?.length ?? 0,
        },
        stateAfter: buildStateSummary(nextState),
        latencyMs: Date.now() - gmRunStartMs,
        inputTokens: llmResponse.inputTokens,
        outputTokens: llmResponse.outputTokens,
      },
    })

    await this.applyAvatarRoutingUpdates(input, currentState, output, eligibleTransitions)

    await this.traceSafe({
      requestId: input.correlationId,
      sessionId: input.sessionId,
      event: 'gm.triggered',
      input: {
        triggerReason,
        turnIndex: input.turnIndex,
      },
      output,
      latencyMs: Date.now() - llmStart,
      inputTokens: llmResponse.inputTokens,
      outputTokens: llmResponse.outputTokens,
      metadata: { model: llmResponse.model },
    })
  }

  private async callLlm(
    gmInput: GameMasterInput,
    input: RunGameMasterInput,
    currentState: GameMasterState,
    triggerReason: string,
    llmStart: number,
    gmRunStartMs: number,
  ): Promise<LlmResponse | null> {
    try {
      return await this.llm.complete({
        systemPrompt: buildGameMasterSystemPrompt(),
        messages: [{ role: 'user', content: JSON.stringify(gmInput) }],
      })
    } catch (err: unknown) {
      console.error('[GM] LLM call failed:', err)
      await this.incrementInteractionAndSave(input.sessionId, currentState)
      const updatedCount = currentState.interactionCount + 1
      await this.emitEventSafe({
        sessionId: input.sessionId,
        type: 'gm_skipped',
        severity: 'info',
        correlationId: input.correlationId,
        payload: {
          triggerReason,
          turnIndex: input.turnIndex,
          interactionCount: updatedCount,
          stateBefore: buildStateSummary(currentState),
          latencyMs: Date.now() - gmRunStartMs,
        },
      })
      await this.traceSafe({
        requestId: input.correlationId,
        sessionId: input.sessionId,
        event: 'gm.llm_error',
        input: { triggerReason },
        latencyMs: Date.now() - llmStart,
      })
      return null
    }
  }

  private async loadCurrentState(sessionId: string): Promise<GameMasterState> {
    return (
      (await this.gmStateRepository.findBySessionId(sessionId)) ?? { ...DEFAULT_GAME_MASTER_STATE }
    )
  }

  private async buildGameMasterInput(
    input: RunGameMasterInput,
    currentState: GameMasterState,
    scenarioContext: ScenarioContext,
    eligibleTransitions: EligibleTransition[],
  ): Promise<GameMasterInput> {
    const availableAvatars = await this.avatarRepository.listByScenarioId(input.scenarioId)

    return {
      session: { sessionId: input.sessionId, turnIndex: input.turnIndex },
      userMessage: { text: input.userMessageText },
      state: currentState,
      context: {
        experience: {
          scenarioId: input.scenarioId,
          ...(scenarioContext.description !== undefined
            ? { description: scenarioContext.description }
            : {}),
          ...(scenarioContext.goals !== undefined ? { goals: scenarioContext.goals } : {}),
        },
        availableAvatars: availableAvatars.map((avatar) => ({
          avatarId: avatar.avatarId,
          name: avatar.name,
          ...(avatar.description !== undefined ? { description: avatar.description } : {}),
        })),
        eligibleTransitions: eligibleTransitions.map((transition) => ({
          toAvatarId: transition.toAvatarId,
          reason: transition.reason,
        })),
        ...(scenarioContext.policy !== undefined ? { policy: scenarioContext.policy } : {}),
      },
    }
  }

  private async performAvatarSwitch(
    input: RunGameMasterInput,
    output: GameMasterOutput,
    eligibleTransitions: EligibleTransition[],
  ): Promise<void> {
    if (this.conversationRepository === undefined || !hasText(output.nextAvatarId)) {
      return
    }

    const nextAvatarId = output.nextAvatarId.trim()

    if (
      eligibleTransitions.length > 0 &&
      !eligibleTransitions.some((transition) => transition.toAvatarId === nextAvatarId)
    ) {
      console.warn(
        '[GM] Skipping avatar switch: nextAvatarId is not in eligible transitions.',
        nextAvatarId,
        eligibleTransitions.map((transition) => transition.toAvatarId),
      )
      return
    }

    try {
      const activeConversation = await this.conversationRepository.findActiveBySessionId(
        input.sessionId,
      )
      const now = new Date().toISOString()

      if (activeConversation !== null) {
        await this.conversationRepository.update(activeConversation.conversationId, {
          status: 'closed',
          endedAt: now,
        })
      }

      await this.conversationRepository.create({
        sessionId: input.sessionId,
        avatarId: nextAvatarId,
        startedBy: 'gm',
        reason: output.transitionReason ?? 'gm_directed',
        ...(activeConversation !== null
          ? { handoffFromConversationId: activeConversation.conversationId }
          : {}),
      })

      await this.sessionRepository.update(input.sessionId, { activeAvatarId: nextAvatarId })
    } catch (err: unknown) {
      console.error('[GM] Avatar switch failed:', err)
    }
  }

  private async persistTriggeredNotes(sessionId: string, output: GameMasterOutput): Promise<void> {
    if (!hasText(output.context?.notes)) return
    await this.sessionRepository.update(sessionId, { gmNotes: output.context.notes.trim() })
  }

  private async applyAvatarRoutingUpdates(
    input: RunGameMasterInput,
    currentState: GameMasterState,
    output: GameMasterOutput,
    eligibleTransitions: EligibleTransition[],
  ): Promise<void> {
    if (
      output.conversationMode === 'new' &&
      hasText(output.nextAvatarId) &&
      this.conversationRepository !== undefined
    ) {
      await this.performAvatarSwitch(input, output, eligibleTransitions)
      return
    }

    if (
      hasText(output.stateUpdate.activeAvatarId) &&
      output.stateUpdate.activeAvatarId.trim() !== currentState.currentAvatarId
    ) {
      await this.sessionRepository.update(input.sessionId, {
        activeAvatarId: output.stateUpdate.activeAvatarId.trim(),
      })
    }
  }

  private async handleSkippedTurn(
    input: RunGameMasterInput,
    currentState: GameMasterState,
    gmRunStartMs: number,
  ): Promise<void> {
    await this.incrementInteractionAndSave(input.sessionId, currentState)
    const updatedState = { ...currentState, interactionCount: currentState.interactionCount + 1 }
    await this.emitEventSafe({
      sessionId: input.sessionId,
      type: 'gm_skipped',
      severity: 'info',
      correlationId: input.correlationId,
      payload: {
        triggerReason: null,
        turnIndex: input.turnIndex,
        interactionCount: updatedState.interactionCount,
        stateBefore: buildStateSummary(currentState),
        latencyMs: Date.now() - gmRunStartMs,
      },
    })
    await this.traceSafe({
      requestId: input.correlationId,
      sessionId: input.sessionId,
      event: 'gm.skipped',
      input: {
        triggerReason: null,
        turnIndex: input.turnIndex,
      },
    })
  }

  private async handleInvalidOutput(
    input: RunGameMasterInput,
    currentState: GameMasterState,
    triggerReason: string,
    llmResponse: {
      content: string
      model: string
      inputTokens: number
      outputTokens: number
    },
    llmStart: number,
    gmRunStartMs: number,
  ): Promise<void> {
    await this.incrementInteractionAndSave(input.sessionId, currentState)
    const updatedState = { ...currentState, interactionCount: currentState.interactionCount + 1 }
    await this.emitEventSafe({
      sessionId: input.sessionId,
      type: 'gm_skipped',
      severity: 'info',
      correlationId: input.correlationId,
      payload: {
        triggerReason,
        turnIndex: input.turnIndex,
        interactionCount: updatedState.interactionCount,
        stateBefore: buildStateSummary(currentState),
        latencyMs: Date.now() - gmRunStartMs,
        inputTokens: llmResponse.inputTokens,
        outputTokens: llmResponse.outputTokens,
      },
    })
    await this.traceSafe({
      requestId: input.correlationId,
      sessionId: input.sessionId,
      event: 'gm.invalid_output',
      input: { triggerReason },
      output: llmResponse.content,
      latencyMs: Date.now() - llmStart,
      inputTokens: llmResponse.inputTokens,
      outputTokens: llmResponse.outputTokens,
      metadata: { model: llmResponse.model },
    })
  }

  private incrementInteractionAndSave(
    sessionId: string,
    currentState: GameMasterState,
  ): Promise<void> {
    return this.gmStateRepository.save(sessionId, {
      ...currentState,
      interactionCount: currentState.interactionCount + 1,
    })
  }

  private async traceSafe(event: {
    requestId: string
    sessionId: string
    event: string
    input?: unknown
    output?: unknown
    latencyMs?: number
    inputTokens?: number
    outputTokens?: number
    metadata?: Record<string, unknown>
  }): Promise<void> {
    try {
      await this.observability.trace(event)
    } catch (err: unknown) {
      console.error('[GM] Observability trace failed for event:', event.event, err)
    }
  }

  private async emitEventSafe(event: StoredEvent): Promise<void> {
    if (this.eventLogRepository === undefined) return
    try {
      await this.eventLogRepository.append(event)
    } catch (err: unknown) {
      console.error('[GM] Event log emission failed for type:', event.type, err)
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
    return {
      ...(hasText(scenario.config.worldContext)
        ? { description: scenario.config.worldContext }
        : {}),
      ...(Array.isArray(scenario.config.objectives) ? { goals: scenario.config.objectives } : {}),
      ...extractScenarioPolicy(scenario.config),
      ...extractScenarioAvatarTransitionRules(scenario.config),
    }
  }
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function buildStateSummary(state: GameMasterState): GameMasterStateSummary {
  return {
    ...(state.currentAvatarId !== undefined ? { currentAvatarId: state.currentAvatarId } : {}),
    progression: state.progression,
    topicsCovered: state.topicsCovered,
  }
}

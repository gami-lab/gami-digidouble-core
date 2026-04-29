import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'
import type { IGmStateRepository } from '../../ports/IGmStateRepository.js'
import type { ILlmAdapter, LlmResponse } from '../../ports/ILlmAdapter.js'
import type { IMessageRepository } from '../../ports/IMessageRepository.js'
import type { IObservabilityAdapter } from '../../ports/IObservabilityAdapter.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
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
} from '../../../domain/game-master/game-master.types.js'
import type { Session } from '../../../domain/conversation/session.types.js'
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
import {
  hasLockedActiveAvatar,
  resolveAvatarUnlocks,
  toGameMasterAvailableAvatars,
} from './run-game-master.avatar-unlocks.js'
import {
  buildStateSummary,
  emitEventSafe,
  emitTriggeredGameMasterTurn,
  handleInvalidGameMasterOutput,
  handleSkippedGameMasterTurn,
  incrementInteractionAndSave,
  traceSafe,
} from './run-game-master.events.js'

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
  ) {}

  async execute(input: RunGameMasterInput): Promise<void> {
    const gmRunStartMs = Date.now()
    const currentState = await this.loadCurrentState(input.sessionId)
    const scenarioContext = await this.loadScenarioContext(input.scenarioId)
    const session = await this.loadSession(input.sessionId)
    const scenarioAvatars = await this.avatarRepository.listByScenarioId(input.scenarioId)
    const triggerReason =
      evaluateTriggers(currentState, scenarioContext.policy) ??
      this.evaluateUnlockTrigger(session, scenarioAvatars)

    if (triggerReason === null) {
      await handleSkippedGameMasterTurn({
        input,
        currentState,
        gmRunStartMs,
        gmStateRepository: this.gmStateRepository,
        observability: this.observability,
        ...(this.eventLogRepository !== undefined
          ? { eventLogRepository: this.eventLogRepository }
          : {}),
      })
      return
    }

    await this.handleTriggeredTurn(
      input,
      currentState,
      scenarioContext,
      session,
      scenarioAvatars,
      triggerReason,
      gmRunStartMs,
    )
  }

  private async handleTriggeredTurn(
    input: RunGameMasterInput,
    currentState: GameMasterState,
    scenarioContext: ScenarioContext,
    session: Session | null,
    scenarioAvatars: AvatarConfig[],
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
      session,
      scenarioAvatars,
      eligibleTransitions,
    )
    const llmStart = Date.now()

    const llmCallResult = await this.callLlm(
      gmInput,
      input,
      currentState,
      triggerReason,
      llmStart,
      gmRunStartMs,
    )
    if (llmCallResult === null) return

    const { llmRequest, llmResponse } = llmCallResult

    const output = safeParseGameMasterOutput(llmResponse.content)
    if (output === null) {
      await handleInvalidGameMasterOutput({
        input,
        currentState,
        triggerReason,
        llmRequest,
        llmResponse,
        llmStart,
        gmRunStartMs,
        gmStateRepository: this.gmStateRepository,
        observability: this.observability,
        ...(this.eventLogRepository !== undefined
          ? { eventLogRepository: this.eventLogRepository }
          : {}),
      })
      return
    }

    const sanitizedStateUpdate = { ...output.stateUpdate }
    if (output.conversationMode === 'new') {
      delete sanitizedStateUpdate.activeAvatarId
    }
    const nextState = reduceGmState(currentState, sanitizedStateUpdate)
    const routingResult = await this.applyAvatarRoutingUpdates(
      input,
      currentState,
      output,
      eligibleTransitions,
    )
    const unlockedAvatarIds = await this.applyAvatarUnlocks(input, session, scenarioAvatars, output)
    const reconciledState: GameMasterState =
      routingResult.switchedAvatarId !== undefined
        ? { ...nextState, currentAvatarId: routingResult.switchedAvatarId }
        : nextState
    await this.gmStateRepository.save(input.sessionId, reconciledState)
    await this.persistTriggeredNotes(input.sessionId, output)

    await emitTriggeredGameMasterTurn({
      input,
      currentState,
      reconciledState,
      output,
      unlockedAvatarIds,
      triggerReason,
      gmRunStartMs,
      llmStart,
      llmRequest,
      llmResponse,
      observability: this.observability,
      ...(this.eventLogRepository !== undefined
        ? { eventLogRepository: this.eventLogRepository }
        : {}),
    })
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
  } | null> {
    const llmRequest = {
      systemPrompt: buildGameMasterSystemPrompt(),
      messages: [{ role: 'user' as const, content: JSON.stringify(gmInput) }],
    }

    try {
      const llmResponse = await this.llm.complete(llmRequest)
      return { llmRequest, llmResponse }
    } catch (err: unknown) {
      console.error('[GM] LLM call failed:', err)
      await incrementInteractionAndSave(this.gmStateRepository, input.sessionId, currentState)
      const updatedCount = currentState.interactionCount + 1
      await emitEventSafe(this.eventLogRepository, {
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
      await traceSafe(this.observability, {
        requestId: input.correlationId,
        sessionId: input.sessionId,
        event: 'gm.llm_error',
        input: {
          triggerReason,
          llmRequest,
        },
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

  private async loadSession(sessionId: string): Promise<Session | null> {
    try {
      return await this.sessionRepository.findById(sessionId)
    } catch (err: unknown) {
      console.error('[GM] Failed to load session for unlock evaluation:', err)
      return null
    }
  }

  private evaluateUnlockTrigger(
    session: Session | null,
    scenarioAvatars: AvatarConfig[],
  ): TriggerReason | null {
    return hasLockedActiveAvatar(session, scenarioAvatars) ? 'avatar_unlock_evaluation' : null
  }

  private async buildGameMasterInput(
    input: RunGameMasterInput,
    currentState: GameMasterState,
    scenarioContext: ScenarioContext,
    session: Session | null,
    scenarioAvatars: AvatarConfig[],
    eligibleTransitions: EligibleTransition[],
  ): Promise<GameMasterInput> {
    const recentMessages: Array<{ role: 'user' | 'avatar' | 'system'; content: string }> =
      await this.loadRecentMessages(input.conversationId)

    return {
      session: { sessionId: input.sessionId, turnIndex: input.turnIndex },
      userMessage: { text: input.userMessageText },
      ...(recentMessages.length > 0 ? { recentMessages } : {}),
      state: currentState,
      context: {
        experience: {
          scenarioId: input.scenarioId,
          ...(scenarioContext.description !== undefined
            ? { description: scenarioContext.description }
            : {}),
          ...(scenarioContext.goals !== undefined ? { goals: scenarioContext.goals } : {}),
        },
        availableAvatars: toGameMasterAvailableAvatars(scenarioAvatars, session),
        eligibleTransitions: eligibleTransitions.map((transition) => ({
          toAvatarId: transition.toAvatarId,
          reason: transition.reason,
        })),
        ...(scenarioContext.policy !== undefined ? { policy: scenarioContext.policy } : {}),
      },
    }
  }

  private async loadRecentMessages(
    conversationId: string | undefined,
  ): Promise<Array<{ role: 'user' | 'avatar' | 'system'; content: string }>> {
    if (conversationId === undefined || this.messageRepository === undefined) return []
    const messages = await this.messageRepository.findByConversationId(conversationId, {
      limit: 12,
    })
    return messages
      .slice()
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .map((message) => ({ role: message.role, content: message.content }))
  }

  private async performAvatarSwitch(
    input: RunGameMasterInput,
    output: GameMasterOutput,
    eligibleTransitions: EligibleTransition[],
  ): Promise<string | undefined> {
    if (this.conversationRepository === undefined || !hasText(output.nextAvatarId)) {
      return undefined
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
      return undefined
    }

    const scenarioAvatarIds = new Set(
      (await this.avatarRepository.listByScenarioId(input.scenarioId))
        .filter((avatar) => avatar.status === 'active')
        .map((avatar) => avatar.avatarId),
    )

    if (!scenarioAvatarIds.has(nextAvatarId)) {
      console.warn(
        '[GM] Skipping avatar switch: nextAvatarId is not an active avatar in the scenario.',
        nextAvatarId,
      )
      return undefined
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
      return nextAvatarId
    } catch (err: unknown) {
      console.error('[GM] Avatar switch failed:', err)
      return undefined
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
  ): Promise<AvatarRoutingResult> {
    if (
      output.conversationMode === 'new' &&
      hasText(output.nextAvatarId) &&
      this.conversationRepository !== undefined
    ) {
      const switchedAvatarId = await this.performAvatarSwitch(input, output, eligibleTransitions)
      return switchedAvatarId !== undefined ? { switchedAvatarId } : {}
    }

    if (
      hasText(output.stateUpdate.activeAvatarId) &&
      output.stateUpdate.activeAvatarId.trim() !== currentState.currentAvatarId
    ) {
      await this.sessionRepository.update(input.sessionId, {
        activeAvatarId: output.stateUpdate.activeAvatarId.trim(),
      })
      return { switchedAvatarId: output.stateUpdate.activeAvatarId.trim() }
    }

    return {}
  }

  private async applyAvatarUnlocks(
    input: RunGameMasterInput,
    session: Session | null,
    scenarioAvatars: AvatarConfig[],
    output: GameMasterOutput,
  ): Promise<string[]> {
    const unlocks = resolveAvatarUnlocks(session, scenarioAvatars, output)
    if (unlocks === null) return []

    await this.sessionRepository.update(input.sessionId, {
      unlockedAvatarIds: unlocks.nextUnlockedAvatarIds,
    })
    return unlocks.newlyUnlockedAvatarIds
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

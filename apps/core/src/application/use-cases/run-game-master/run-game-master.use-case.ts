import crypto from 'node:crypto'
import type { RuntimeEvent } from '@gami/shared'
import type { IAvatarRepository } from '../../ports/IAvatarRepository.js'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'
import type { IGmStateRepository } from '../../ports/IGmStateRepository.js'
import type { ILlmAdapter, LlmResponse } from '../../ports/ILlmAdapter.js'
import type { IMessageRepository } from '../../ports/IMessageRepository.js'
import type { IObservabilityAdapter } from '../../ports/IObservabilityAdapter.js'
import type { IScenarioRepository } from '../../ports/IScenarioRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { ISessionEventPublisher } from '../../ports/ISessionEventPublisher.js'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import { buildGameMasterSystemPrompt } from '../../../domain/game-master/gm-prompt.service.js'
import { reduceGmState } from '../../../domain/game-master/gm-state-reducer.js'
import type {
  GameMasterInput,
  GameMasterOutput,
  GameMasterState,
} from '../../../domain/game-master/game-master.types.js'
import type { Session } from '../../../domain/conversation/session.types.js'
import type { LayeredMemorySnapshot } from '../../../domain/memory/memory.types.js'
import {
  MEMORY_LONG_TERM_FACT_LIMIT,
  MEMORY_SHORT_TERM_EXCHANGE_LIMIT,
} from '../../../domain/memory/memory.policy.js'
import type { RunGameMasterInput } from './run-game-master.types.js'
import { AvatarMemoryContextAssembler } from '../../services/avatar-memory-context-assembler.service.js'
import { safeParseGameMasterOutput } from './run-game-master.helpers.js'
import {
  resolveAvatarUnlocks,
  toGameMasterAvailableAvatars,
} from './run-game-master.avatar-unlocks.js'
import {
  emitGameMasterError,
  emitTriggeredGameMasterTurn,
  handleInvalidGameMasterOutput,
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
    private readonly sessionEventPublisher?: ISessionEventPublisher,
    private readonly memoryContextAssembler?: AvatarMemoryContextAssembler,
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
    const gmInput = await this.buildGameMasterInput(
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
    const routingResult = this.applyAvatarRoutingUpdates(
      input,
      currentState,
      session,
      scenarioAvatars,
      output,
    )
    const unlockedAvatarIds = await this.applyAvatarUnlocks(
      input,
      session,
      scenarioAvatars,
      output,
      gmInput.recentMessages,
    )
    this.publishDecisionRuntimeEvents(input, output, unlockedAvatarIds)

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
      ...(routingResult.switchedAvatarId !== undefined
        ? { switchedAvatarId: routingResult.switchedAvatarId }
        : {}),
      triggerReason,
      gmRunStartMs,
      llmStart,
      llmLatencyMs,
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
    llmLatencyMs: number
  } | null> {
    const llmRequest = {
      systemPrompt: buildGameMasterSystemPrompt(),
      messages: [{ role: 'user' as const, content: JSON.stringify(gmInput) }],
    }

    try {
      const llmCallStart = Date.now()
      const llmResponse = await this.llm.complete(llmRequest)
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

  private async buildGameMasterInput(
    input: RunGameMasterInput,
    currentState: GameMasterState,
    scenarioContext: ScenarioContext,
    session: Session | null,
    scenarioAvatars: AvatarConfig[],
  ): Promise<GameMasterInput> {
    const recentMessages = await this.loadRecentMessages(input.conversationId)
    const memory = await this.loadMemoryContext(input, session, recentMessages)

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
        ...(memory !== undefined ? { memory } : {}),
        ...(input.userPersona !== undefined ? { userPersona: input.userPersona } : {}),
        availableAvatars: toGameMasterAvailableAvatars(scenarioAvatars, session),
      },
    }
  }

  private async loadMemoryContext(
    input: RunGameMasterInput,
    session: Session | null,
    recentMessages: GameMasterInput['recentMessages'],
  ): Promise<GameMasterInput['context']['memory'] | undefined> {
    if (
      this.memoryContextAssembler === undefined ||
      session === null ||
      input.conversationId === undefined
    ) {
      return this.buildLegacyMemoryContext(recentMessages, session)
    }

    const memorySnapshot = await this.memoryContextAssembler.build({
      conversationId: input.conversationId,
      sessionId: input.sessionId,
      avatarId: input.avatarId,
      userId: session.userId,
    })

    return (
      this.toGameMasterMemoryContext(memorySnapshot) ??
      this.buildLegacyMemoryContext(recentMessages, session)
    )
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

  private buildLegacyMemoryContext(
    recentMessages: GameMasterInput['recentMessages'],
    session: Session | null,
  ): GameMasterInput['context']['memory'] | undefined {
    const normalizedRecentMessages = recentMessages ?? []
    const recentExchanges = this.buildRecentExchanges(normalizedRecentMessages)
    const workingSummary = hasText(session?.memorySummary)
      ? session.memorySummary.trim()
      : undefined

    if (recentExchanges.length === 0 && workingSummary === undefined) return undefined
    return {
      ...(recentExchanges.length > 0 ? { shortTerm: { recentExchanges } } : {}),
      ...(workingSummary !== undefined ? { workingSummary } : {}),
    }
  }

  private toGameMasterMemoryContext(
    memorySnapshot: LayeredMemorySnapshot | undefined,
  ): GameMasterInput['context']['memory'] | undefined {
    if (memorySnapshot === undefined) return undefined
    const recentExchanges = memorySnapshot.shortTerm?.recentExchanges ?? []
    const workingSummary = this.buildWorkingSummary(memorySnapshot)
    const boundedLongTermFacts = this.getBoundedLongTermFacts(memorySnapshot)

    if (!this.hasMemoryLayer(recentExchanges, workingSummary, boundedLongTermFacts))
      return undefined

    return {
      ...(recentExchanges.length > 0 ? { shortTerm: { recentExchanges } } : {}),
      ...(workingSummary !== undefined ? { workingSummary } : {}),
      ...(boundedLongTermFacts !== undefined ? { longTermFacts: boundedLongTermFacts } : {}),
    }
  }

  private buildRecentExchanges(
    recentMessages: Array<{ role: 'user' | 'avatar' | 'system'; content: string }>,
  ): Array<{ user: string; avatar: string }> {
    const exchanges: Array<{ user: string; avatar: string }> = []
    let pendingUserMessage: string | null = null

    for (const message of recentMessages) {
      if (message.role === 'user') {
        pendingUserMessage = message.content
        continue
      }
      if (message.role === 'avatar' && pendingUserMessage !== null) {
        exchanges.push({ user: pendingUserMessage, avatar: message.content })
        pendingUserMessage = null
      }
    }

    return exchanges.slice(-MEMORY_SHORT_TERM_EXCHANGE_LIMIT)
  }

  private buildWorkingSummary(memorySnapshot: LayeredMemorySnapshot): string | undefined {
    const segments: string[] = []
    if (hasText(memorySnapshot.working?.session?.summary)) {
      segments.push(memorySnapshot.working.session.summary.trim())
    }
    if (hasText(memorySnapshot.working?.avatar?.summary)) {
      segments.push(
        `Avatar (${memorySnapshot.working.avatar.avatarId}): ${memorySnapshot.working.avatar.summary.trim()}`,
      )
    }
    return segments.length > 0 ? segments.join('\n') : undefined
  }

  private getBoundedLongTermFacts(memorySnapshot: LayeredMemorySnapshot) {
    const facts = memorySnapshot.longTerm?.facts
    if (!Array.isArray(facts) || facts.length === 0) return undefined
    return facts.slice(0, MEMORY_LONG_TERM_FACT_LIMIT)
  }

  private hasMemoryLayer(
    recentExchanges: Array<{ user: string; avatar: string }>,
    workingSummary: string | undefined,
    longTermFacts: Array<{ category: string; key: string; value: string }> | undefined,
  ): boolean {
    return recentExchanges.length > 0 || workingSummary !== undefined || longTermFacts !== undefined
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
  ): Promise<string[]> {
    const unlocks = resolveAvatarUnlocks(session, scenarioAvatars, output, recentMessages)
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

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

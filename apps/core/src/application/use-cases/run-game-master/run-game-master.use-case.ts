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
import type { RunGameMasterInput } from './run-game-master.types.js'
import { MemorySelectionService } from '../../services/memory-selection.service.js'
import { safeParseGameMasterOutput } from './run-game-master.helpers.js'
import {
  normalizeGameMasterOutput,
  toRecentExchangeMessages,
  toWorkingMemoryPromptContext,
} from './run-game-master.normalization.js'
import {
  resolveAvatarUnlocks,
  toGameMasterAvailableAvatars,
} from './run-game-master.avatar-unlocks.js'
import {
  emitGameMasterError,
  emitTriggeredGameMasterTurn,
  handleInvalidGameMasterOutput,
  incrementInteractionAndSave,
} from './run-game-master.events.js'

const DEFAULT_GAME_MASTER_STATE: GameMasterState = {
  progression: '',
  topicsCovered: [],
  interactionCount: 0,
}
const GM_RECENT_EXCHANGE_LIMIT = 3

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
    private readonly memorySelectionService?: MemorySelectionService,
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
    const unlockedAvatarIds = await this.applyAvatarUnlocks(
      input,
      session,
      scenarioAvatars,
      normalizedOutput,
      gmInput.recentMessages,
    )
    this.publishDecisionRuntimeEvents(input, normalizedOutput, unlockedAvatarIds)

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
    const llmRequest = {
      systemPrompt: buildGameMasterSystemPrompt(),
      messages: [{ role: 'user' as const, content: JSON.stringify(gmInput) }],
      trace: {
        requestId: input.correlationId,
        sessionId: input.sessionId,
        event: 'gm.llm_completion',
        errorEvent: 'gm.llm_error',
        metadata: {
          triggerReason,
          conversationId: input.conversationId,
          turnIndex: input.turnIndex,
        },
      },
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
    const memory = await this.loadMemoryContext(input, session)
    const recentMessages = await this.loadRecentMessages(input.conversationId, memory)

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
  ): Promise<GameMasterInput['context']['memory'] | undefined> {
    if (input.selectedMemory !== undefined) {
      return this.getMemorySelectionServiceForFallback().toGameMasterMemoryContext(
        input.selectedMemory,
      )
    }
    if (
      session === null ||
      input.conversationId === undefined ||
      this.messageRepository === undefined
    ) {
      return undefined
    }
    try {
      const selectedMemory = await this.getMemorySelectionService().select({
        conversationId: input.conversationId,
        userId: session.userId,
        avatarId: input.avatarId,
        scenarioId: input.scenarioId,
        userMessageText: input.userMessageText,
      })
      return this.getMemorySelectionService().toGameMasterMemoryContext(selectedMemory)
    } catch {
      return undefined
    }
  }

  private async loadRecentMessages(
    conversationId: string | undefined,
    memory: GameMasterInput['context']['memory'],
  ): Promise<Array<{ role: 'user' | 'avatar' | 'system'; content: string }>> {
    if (conversationId === undefined || this.messageRepository === undefined) return []
    const messages = await this.messageRepository.findByConversationId(conversationId, {
      limit: 24,
    })
    const recentMessages = toRecentExchangeMessages(
      messages
        .slice()
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
        .map((message) => ({ role: message.role, content: message.content })),
      GM_RECENT_EXCHANGE_LIMIT,
    )

    if (memory?.workingMemory === undefined) return recentMessages

    return [
      ...recentMessages,
      {
        role: 'system',
        content: toWorkingMemoryPromptContext(memory.workingMemory),
      },
    ]
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

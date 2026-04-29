import type { IEventLogRepository, StoredEvent } from '../../ports/IEventLogRepository.js'
import type { IGmStateRepository } from '../../ports/IGmStateRepository.js'
import type { IObservabilityAdapter } from '../../ports/IObservabilityAdapter.js'
import type {
  GameMasterOutput,
  GameMasterState,
  GameMasterStateSummary,
} from '../../../domain/game-master/game-master.types.js'
import type { RunGameMasterInput } from './run-game-master.types.js'

export async function handleSkippedGameMasterTurn(args: {
  input: RunGameMasterInput
  currentState: GameMasterState
  gmRunStartMs: number
  gmStateRepository: IGmStateRepository
  observability: IObservabilityAdapter
  eventLogRepository?: IEventLogRepository
}): Promise<void> {
  await incrementInteractionAndSave(args.gmStateRepository, args.input.sessionId, args.currentState)
  const updatedState = incrementedState(args.currentState)
  await emitEventSafe(args.eventLogRepository, {
    sessionId: args.input.sessionId,
    type: 'gm_skipped',
    severity: 'info',
    correlationId: args.input.correlationId,
    payload: {
      triggerReason: null,
      turnIndex: args.input.turnIndex,
      interactionCount: updatedState.interactionCount,
      stateBefore: buildStateSummary(args.currentState),
      latencyMs: Date.now() - args.gmRunStartMs,
    },
  })
  await traceSafe(args.observability, {
    requestId: args.input.correlationId,
    sessionId: args.input.sessionId,
    event: 'gm.skipped',
    input: { triggerReason: null, turnIndex: args.input.turnIndex },
  })
}

export async function handleInvalidGameMasterOutput(args: {
  input: RunGameMasterInput
  currentState: GameMasterState
  triggerReason: string
  llmRequest: {
    systemPrompt: string
    messages: Array<{ role: 'user'; content: string }>
  }
  llmResponse: {
    content: string
    model: string
    inputTokens: number
    outputTokens: number
  }
  llmStart: number
  gmRunStartMs: number
  gmStateRepository: IGmStateRepository
  observability: IObservabilityAdapter
  eventLogRepository?: IEventLogRepository
}): Promise<void> {
  await incrementInteractionAndSave(args.gmStateRepository, args.input.sessionId, args.currentState)
  const updatedState = incrementedState(args.currentState)
  await emitEventSafe(args.eventLogRepository, {
    sessionId: args.input.sessionId,
    type: 'gm_skipped',
    severity: 'info',
    correlationId: args.input.correlationId,
    payload: {
      triggerReason: args.triggerReason,
      turnIndex: args.input.turnIndex,
      interactionCount: updatedState.interactionCount,
      stateBefore: buildStateSummary(args.currentState),
      latencyMs: Date.now() - args.gmRunStartMs,
      inputTokens: args.llmResponse.inputTokens,
      outputTokens: args.llmResponse.outputTokens,
    },
  })
  await traceSafe(args.observability, {
    requestId: args.input.correlationId,
    sessionId: args.input.sessionId,
    event: 'gm.invalid_output',
    input: {
      triggerReason: args.triggerReason,
      llmRequest: args.llmRequest,
    },
    output: args.llmResponse.content,
    latencyMs: Date.now() - args.llmStart,
    inputTokens: args.llmResponse.inputTokens,
    outputTokens: args.llmResponse.outputTokens,
    metadata: { model: args.llmResponse.model },
  })
}

export async function emitTriggeredGameMasterTurn(args: {
  input: RunGameMasterInput
  currentState: GameMasterState
  reconciledState: GameMasterState
  output: GameMasterOutput
  unlockedAvatarIds: string[]
  triggerReason: string
  gmRunStartMs: number
  llmStart: number
  llmRequest: {
    systemPrompt: string
    messages: Array<{ role: 'user'; content: string }>
  }
  llmResponse: {
    model: string
    inputTokens: number
    outputTokens: number
  }
  observability: IObservabilityAdapter
  eventLogRepository?: IEventLogRepository
}): Promise<void> {
  await emitEventSafe(args.eventLogRepository, {
    sessionId: args.input.sessionId,
    type: 'gm_triggered',
    severity: 'info',
    correlationId: args.input.correlationId,
    payload: {
      triggerReason: args.triggerReason,
      turnIndex: args.input.turnIndex,
      interactionCount: args.reconciledState.interactionCount,
      stateBefore: buildStateSummary(args.currentState),
      decision: buildTriggeredDecision(args.output, args.unlockedAvatarIds),
      stateAfter: buildStateSummary(args.reconciledState),
      latencyMs: Date.now() - args.gmRunStartMs,
      inputTokens: args.llmResponse.inputTokens,
      outputTokens: args.llmResponse.outputTokens,
    },
  })
  await traceSafe(args.observability, {
    requestId: args.input.correlationId,
    sessionId: args.input.sessionId,
    event: 'gm.triggered',
    input: {
      triggerReason: args.triggerReason,
      turnIndex: args.input.turnIndex,
      llmRequest: args.llmRequest,
    },
    output: args.output,
    latencyMs: Date.now() - args.llmStart,
    inputTokens: args.llmResponse.inputTokens,
    outputTokens: args.llmResponse.outputTokens,
    metadata: { model: args.llmResponse.model },
  })
}

export async function traceSafe(
  observability: IObservabilityAdapter,
  event: {
    requestId: string
    sessionId: string
    event: string
    input?: unknown
    output?: unknown
    latencyMs?: number
    inputTokens?: number
    outputTokens?: number
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  try {
    await observability.trace(event)
  } catch (err: unknown) {
    console.error('[GM] Observability trace failed for event:', event.event, err)
  }
}

export async function emitEventSafe(
  eventLogRepository: IEventLogRepository | undefined,
  event: StoredEvent,
): Promise<void> {
  if (eventLogRepository === undefined) return
  try {
    await eventLogRepository.append(event)
  } catch (err: unknown) {
    console.error('[GM] Event log emission failed for type:', event.type, err)
  }
}

export function incrementInteractionAndSave(
  gmStateRepository: IGmStateRepository,
  sessionId: string,
  currentState: GameMasterState,
): Promise<void> {
  return gmStateRepository.save(sessionId, incrementedState(currentState))
}

export function buildStateSummary(state: GameMasterState): GameMasterStateSummary {
  return {
    ...(state.currentAvatarId !== undefined ? { currentAvatarId: state.currentAvatarId } : {}),
    progression: state.progression,
    topicsCovered: state.topicsCovered,
  }
}

export function buildTriggeredDecision(
  output: GameMasterOutput,
  unlockedAvatarIds: string[],
): Record<string, unknown> {
  return {
    avatarId: output.avatarId,
    conversationMode: output.conversationMode,
    notesInjected: Boolean(output.context?.notes),
    directiveCount: output.recommendedChoices?.length ?? 0,
    ...(unlockedAvatarIds.length > 0 ? { unlockedAvatarIds } : {}),
    ...(output.suggestedAvatarId !== undefined
      ? { suggestedAvatarId: output.suggestedAvatarId }
      : {}),
    ...(output.suggestedAvatarReason !== undefined
      ? { suggestedAvatarReason: output.suggestedAvatarReason }
      : {}),
  }
}

function incrementedState(currentState: GameMasterState): GameMasterState {
  return { ...currentState, interactionCount: currentState.interactionCount + 1 }
}

import type { IEventLogRepository, StoredEvent } from '../../ports/IEventLogRepository.js'
import type { IObservabilityAdapter } from '../../ports/IObservabilityAdapter.js'
import type {
  GameMasterOutput,
  GameMasterState,
  GameMasterStateSummary,
} from '../../../domain/game-master/game-master.types.js'
import type { GmContextSnapshot } from '../../../domain/context/session-context.types.js'
import type { RunGameMasterInput } from './run-game-master.types.js'
import type { UnlockEvaluation } from './run-game-master.avatar-unlocks.js'
import { toRecordedGmContextSnapshot } from '../../services/runtime-inspector-event-context.js'

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
  observability: IObservabilityAdapter
  eventLogRepository?: IEventLogRepository
}): Promise<void> {
  await emitGameMasterError(args.eventLogRepository, {
    input: args.input,
    currentState: args.currentState,
    triggerReason: args.triggerReason,
    latencyMs: Date.now() - args.gmRunStartMs,
    errorCode: 'invalid_output',
    inputTokens: args.llmResponse.inputTokens,
    outputTokens: args.llmResponse.outputTokens,
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

export async function emitGameMasterError(
  eventLogRepository: IEventLogRepository | undefined,
  event: {
    input: RunGameMasterInput
    currentState: GameMasterState
    triggerReason: string
    latencyMs: number
    errorCode: 'llm_error' | 'invalid_output'
    inputTokens?: number
    outputTokens?: number
  },
): Promise<void> {
  await emitEventSafe(eventLogRepository, {
    sessionId: event.input.sessionId,
    type: 'gm_error',
    severity: 'error',
    correlationId: event.input.correlationId,
    payload: {
      triggerReason: event.triggerReason,
      turnIndex: event.input.turnIndex,
      interactionCount: event.currentState.interactionCount,
      stateBefore: buildStateSummary(event.currentState),
      latencyMs: event.latencyMs,
      errorCode: event.errorCode,
      ...(event.inputTokens !== undefined ? { inputTokens: event.inputTokens } : {}),
      ...(event.outputTokens !== undefined ? { outputTokens: event.outputTokens } : {}),
    },
  })
}

export async function emitTriggeredGameMasterTurn(args: {
  input: RunGameMasterInput
  currentState: GameMasterState
  reconciledState: GameMasterState
  output: GameMasterOutput
  gmContext: GmContextSnapshot
  unlockedAvatarIds: string[]
  unlockEvaluations: UnlockEvaluation[]
  switchedAvatarId?: string
  triggerReason: string
  gmRunStartMs: number
  llmStart: number
  llmLatencyMs: number
  llmRequest: {
    systemPrompt: string
    messages: Array<{ role: 'user'; content: string }>
  }
  llmResponse: {
    model: string
    inputTokens: number
    outputTokens: number
  }
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
      gmContext: toRecordedGmContextSnapshot(args.gmContext),
      decision: buildTriggeredDecision(
        args.output,
        args.unlockedAvatarIds,
        args.unlockEvaluations,
        args.switchedAvatarId,
      ),
      stateAfter: buildStateSummary(args.reconciledState),
      latencyMs: args.llmLatencyMs,
      totalLatencyMs: Date.now() - args.gmRunStartMs,
      inputTokens: args.llmResponse.inputTokens,
      outputTokens: args.llmResponse.outputTokens,
      correlationId: args.input.correlationId,
    },
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

export function buildStateSummary(state: GameMasterState): GameMasterStateSummary {
  return {
    progression: state.progression,
    topicsCovered: state.topicsCovered ?? [],
  }
}

// eslint-disable-next-line complexity
export function buildTriggeredDecision(
  output: GameMasterOutput,
  unlockedAvatarIds: string[],
  unlockEvaluations: UnlockEvaluation[],
  switchedAvatarId: string | undefined,
): Record<string, unknown> {
  const injectedNote = normalizeInjectedNote(output.directorNotes)

  return {
    dialogueMode: output.dialogueControl.mode,
    askFollowUp: output.dialogueControl.askFollowUp,
    notesInjected: Boolean(output.directorNotes),
    ...(injectedNote !== undefined ? { injectedNote } : {}),
    retrievalRequired: output.retrievalPlan.required,
    retrievalPlan: {
      required: output.retrievalPlan.required,
      queries: output.retrievalPlan.queries ?? [],
      requiredFacts: output.retrievalPlan.requiredFacts ?? [],
    },
    ...(output.routing !== undefined ? { routingAction: output.routing.action } : {}),
    ...(output.routing?.avatarId !== undefined ? { routingAvatarId: output.routing.avatarId } : {}),
    ...(output.routing?.reason !== undefined ? { routingReason: output.routing.reason } : {}),
    ...(unlockedAvatarIds.length > 0 ? { unlockedAvatarIds } : {}),
    ...(unlockEvaluations.length > 0 ? { unlockEvaluations } : {}),
    ...(switchedAvatarId !== undefined ? { switchedAvatarId } : {}),
    progression: output.progressionUpdate.progression,
    ...(output.progressionUpdate.objectiveId !== undefined
      ? { objectiveId: output.progressionUpdate.objectiveId }
      : {}),
  }
}

function normalizeInjectedNote(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length === 0) return undefined
  const MAX_NOTE_LENGTH = 240
  return normalized.length <= MAX_NOTE_LENGTH
    ? normalized
    : `${normalized.slice(0, MAX_NOTE_LENGTH - 1)}…`
}

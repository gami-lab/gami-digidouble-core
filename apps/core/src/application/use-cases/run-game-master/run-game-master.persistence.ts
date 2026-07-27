import type {
  GameMasterOrchestrationState,
  GameMasterOutput,
  GameMasterState,
} from '../../../domain/game-master/game-master.types.js'
import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'
import type { IGmStateRepository } from '../../ports/IGmStateRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import { emitGameMasterError } from './run-game-master.events.js'
import type { RunGameMasterInput } from './run-game-master.types.js'

export async function persistGameMasterResult(args: {
  gmStateRepository: IGmStateRepository
  sessionRepository: ISessionRepository
  eventLogRepository?: IEventLogRepository
  input: RunGameMasterInput
  currentState: GameMasterState
  nextState: GameMasterState
  effectiveOutput: GameMasterOutput
  switchedAvatarId: string | undefined
  triggerReason: string
  gmRunStartMs: number
}): Promise<void> {
  try {
    await args.gmStateRepository.save(args.input.sessionId, {
      ...args.nextState,
      nextTurnOrchestration: buildNextTurnOrchestration(
        args.input,
        args.effectiveOutput,
        args.switchedAvatarId,
      ),
    })
    if (args.effectiveOutput.directorNotes.trim().length > 0) {
      await args.sessionRepository.update(args.input.sessionId, {
        gmNotes: args.effectiveOutput.directorNotes.trim(),
      })
    }
  } catch (error: unknown) {
    console.error('[GM] State persistence failed:', error)
    await emitGameMasterError(args.eventLogRepository, {
      input: args.input,
      currentState: args.currentState,
      triggerReason: args.triggerReason,
      latencyMs: Date.now() - args.gmRunStartMs,
      errorCode: 'persistence_error',
    })
    throw error
  }
}

function buildNextTurnOrchestration(
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

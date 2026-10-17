import type { SelectedMemoryPayload } from '../../../domain/memory/memory.types.js'
import type { UserPersona } from '../../../domain/user/user.types.js'
import type { IMemoryMaintenancePort } from '../../ports/IMemoryMaintenancePort.js'
import type { RunGameMasterUseCase } from '../run-game-master/run-game-master.use-case.js'

export type BackgroundTurn = {
  requestId: string
  sessionId: string
  scenarioId: string
  conversationId: string
  avatarId: string
  userMessage: string
  turnIndex: number
  userPersona: UserPersona | undefined
  selectedMemory?: SelectedMemoryPayload
}

export function dispatchRunGameMaster(
  runGameMaster: RunGameMasterUseCase | null,
  turn: BackgroundTurn,
): void {
  if (runGameMaster === null) return
  void runGameMaster
    .execute({
      sessionId: turn.sessionId,
      scenarioId: turn.scenarioId,
      avatarId: turn.avatarId,
      conversationId: turn.conversationId,
      userMessageText: turn.userMessage,
      turnIndex: turn.turnIndex,
      correlationId: turn.requestId,
      ...(turn.userPersona !== undefined ? { userPersona: turn.userPersona } : {}),
      ...(turn.selectedMemory !== undefined ? { selectedMemory: turn.selectedMemory } : {}),
    })
    .catch((err: unknown) => {
      console.error(
        '[GM] Background execution failed for session:',
        turn.sessionId,
        'correlationId:',
        turn.requestId,
        err,
      )
    })
}

export function dispatchMemoryMaintenance(
  memoryMaintenance: IMemoryMaintenancePort | undefined,
  turn: Pick<
    BackgroundTurn,
    'requestId' | 'sessionId' | 'scenarioId' | 'conversationId' | 'avatarId'
  >,
): void {
  if (memoryMaintenance === undefined) return
  void Promise.resolve(
    memoryMaintenance.execute({
      sessionId: turn.sessionId,
      conversationId: turn.conversationId,
      avatarId: turn.avatarId,
      scenarioId: turn.scenarioId,
      trigger: 'post_turn',
      correlationId: turn.requestId,
    }),
  ).catch((error: unknown) => {
    console.error('[memory-maintenance] Background refresh failed:', error)
  })
}

export async function awaitPendingWorkingMemoryRefresh(
  memoryMaintenance: IMemoryMaintenancePort | undefined,
  conversationId: string,
): Promise<void> {
  if (memoryMaintenance?.awaitPendingRefresh === undefined) return
  try {
    await memoryMaintenance.awaitPendingRefresh(conversationId)
  } catch (error) {
    console.error('[memory-maintenance] Await pending refresh failed:', error)
  }
}

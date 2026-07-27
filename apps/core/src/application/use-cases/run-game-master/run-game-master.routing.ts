import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { GameMasterOutput } from '../../../domain/game-master/game-master.types.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { RunGameMasterInput } from './run-game-master.types.js'

export type AvatarRoutingResult = {
  switchedAvatarId?: string
  routing?: GameMasterOutput['routing']
}

export async function applyAvatarRoutingUpdates(args: {
  sessionRepository: ISessionRepository
  input: RunGameMasterInput
  session: {
    unlockedAvatarIds?: string[]
  } | null
  scenarioAvatars: AvatarConfig[]
  output: GameMasterOutput
  unlockResult: { newlyUnlockedAvatarIds: string[]; evaluations: Array<{ outcome: string }> }
}): Promise<AvatarRoutingResult> {
  const routing = args.output.routing
  if (routing === undefined) return {}
  if (routing.action === 'stay') return { routing }

  const activeAvatarIds = new Set(
    args.scenarioAvatars
      .filter((avatar) => avatar.status === 'active')
      .map((avatar) => avatar.avatarId),
  )
  const unlockedAvatarIds = new Set([
    ...(args.session?.unlockedAvatarIds ?? args.scenarioAvatars.map((avatar) => avatar.avatarId)),
    ...args.unlockResult.newlyUnlockedAvatarIds,
  ])
  const targetAvatarId = routing.avatarId

  if (routing.action === 'suggest' || routing.action === 'switch') {
    return handleDirectRouting(args, routing, targetAvatarId, activeAvatarIds, unlockedAvatarIds)
  }
  if (routing.action === 'unlock_and_switch') {
    return handleUnlockAndSwitch(args, routing, targetAvatarId, activeAvatarIds)
  }
  if (hasSuccessfulUnlock(args.unlockResult.evaluations)) {
    return { routing }
  }
  return { routing: { action: 'stay' } }
}

async function handleDirectRouting(
  args: {
    sessionRepository: ISessionRepository
    input: RunGameMasterInput
  },
  routing: NonNullable<GameMasterOutput['routing']>,
  targetAvatarId: string | undefined,
  activeAvatarIds: Set<string>,
  unlockedAvatarIds: Set<string>,
): Promise<AvatarRoutingResult> {
  if (
    targetAvatarId === undefined ||
    !activeAvatarIds.has(targetAvatarId) ||
    !unlockedAvatarIds.has(targetAvatarId)
  ) {
    return { routing: { action: 'stay' } }
  }
  if (routing.action === 'suggest') return { routing }
  await args.sessionRepository.update(args.input.sessionId, { activeAvatarId: targetAvatarId })
  return { switchedAvatarId: targetAvatarId, routing }
}

async function handleUnlockAndSwitch(
  args: {
    sessionRepository: ISessionRepository
    input: RunGameMasterInput
    session: { unlockedAvatarIds?: string[] } | null
    unlockResult: { newlyUnlockedAvatarIds: string[] }
  },
  routing: NonNullable<GameMasterOutput['routing']>,
  targetAvatarId: string | undefined,
  activeAvatarIds: Set<string>,
): Promise<AvatarRoutingResult> {
  const wasLocked =
    targetAvatarId !== undefined &&
    args.session?.unlockedAvatarIds?.includes(targetAvatarId) !== true
  const wasUnlocked =
    targetAvatarId !== undefined &&
    args.unlockResult.newlyUnlockedAvatarIds.includes(targetAvatarId)
  if (
    targetAvatarId === undefined ||
    !wasLocked ||
    !wasUnlocked ||
    !activeAvatarIds.has(targetAvatarId)
  ) {
    return { routing: { action: 'stay' } }
  }
  await args.sessionRepository.update(args.input.sessionId, { activeAvatarId: targetAvatarId })
  return { switchedAvatarId: targetAvatarId, routing }
}

function hasSuccessfulUnlock(evaluations: Array<{ outcome: string }>): boolean {
  return evaluations.some((evaluation) => evaluation.outcome === 'unlocked')
}

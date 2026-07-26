import type { AvatarConfig } from '../avatar/avatar.types.js'
import type { GameMasterOutput, RoutingDecision } from './game-master.types.js'

export function normalizeGameMasterOutput(
  output: GameMasterOutput,
  scenarioAvatars: AvatarConfig[],
): GameMasterOutput {
  const activeAvatars = scenarioAvatars.filter((avatar) => avatar.status === 'active')
  const routing =
    activeAvatars.length > 1 ? normalizeRouting(output.routing, activeAvatars) : undefined

  return {
    dialogueControl: output.dialogueControl,
    retrievalPlan: output.retrievalPlan,
    directorNotes: output.directorNotes,
    ...(routing !== undefined ? { routing } : {}),
    progressionUpdate: output.progressionUpdate,
  }
}

function normalizeRouting(
  routing: RoutingDecision | undefined,
  activeAvatars: AvatarConfig[],
): RoutingDecision | undefined {
  if (routing === undefined) return undefined

  if (routing.action === 'stay') {
    return { action: 'stay', ...(routing.reason !== undefined ? { reason: routing.reason } : {}) }
  }

  if (routing.action === 'unlock') {
    return normalizeUnlockRouting(routing, activeAvatars)
  }

  // 'suggest' | 'switch' | 'unlock_and_switch' — all require a single resolvable avatarId.
  const avatarId = normalizeOptionalReference(routing.avatarId, activeAvatars)
  if (avatarId === undefined) return { action: 'stay' }

  return {
    action: routing.action,
    avatarId,
    ...(routing.reason !== undefined ? { reason: routing.reason } : {}),
  }
}

function normalizeUnlockRouting(
  routing: RoutingDecision,
  activeAvatars: AvatarConfig[],
): RoutingDecision | undefined {
  const unlockDecisions = normalizeUnlockDecisions(routing.unlockDecisions, activeAvatars)
  if (unlockDecisions.length > 0) {
    return { action: 'unlock', unlockDecisions }
  }

  const avatarId = normalizeOptionalReference(routing.avatarId, activeAvatars)
  if (avatarId === undefined) return { action: 'stay' }

  return {
    action: 'unlock',
    avatarId,
    ...(routing.reason !== undefined ? { reason: routing.reason } : {}),
  }
}

function normalizeOptionalReference(
  value: string | undefined,
  avatars: AvatarConfig[],
): string | undefined {
  if (value === undefined) return undefined
  return resolveAvatarReference(value, avatars)
}

function resolveAvatarReference(value: string, avatars: AvatarConfig[]): string | undefined {
  const trimmed = value.trim()
  if (trimmed.length === 0) return undefined

  const byId = avatars.find((avatar) => avatar.avatarId === trimmed)
  if (byId !== undefined) return byId.avatarId

  const lowered = trimmed.toLowerCase()
  const byName = avatars.find((avatar) => avatar.name.trim().toLowerCase() === lowered)
  return byName?.avatarId
}

function normalizeUnlockDecisions(
  decisions: RoutingDecision['unlockDecisions'],
  avatars: AvatarConfig[],
): Array<{ avatarId: string; reason: string }> {
  if (decisions === undefined) return []

  return decisions.reduce<Array<{ avatarId: string; reason: string }>>((normalized, decision) => {
    const avatarId = resolveAvatarReference(decision.avatarId, avatars)
    if (avatarId === undefined) return normalized
    if (normalized.some((entry) => entry.avatarId === avatarId)) return normalized
    normalized.push({ avatarId, reason: decision.reason })
    return normalized
  }, [])
}

import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { GameMasterOutput } from '../../../domain/game-master/game-master.types.js'

export function toRecentExchangeMessages(
  messages: Array<{ role: 'user' | 'avatar' | 'system'; content: string }>,
  exchangeLimit: number,
): Array<{ role: 'user' | 'avatar' | 'system'; content: string }> {
  const exchanges: Array<Array<{ role: 'user' | 'avatar' | 'system'; content: string }>> = []
  let pendingUser: { role: 'user' | 'avatar' | 'system'; content: string } | undefined

  for (const message of messages) {
    if (message.role === 'user') {
      pendingUser = message
      continue
    }
    if (message.role === 'avatar' && pendingUser !== undefined) {
      exchanges.push([pendingUser, message])
      pendingUser = undefined
    }
  }

  return exchanges.slice(-exchangeLimit).flat()
}

export function normalizeGameMasterOutput(
  output: GameMasterOutput,
  scenarioAvatars: AvatarConfig[],
): GameMasterOutput | null {
  const activeAvatars = scenarioAvatars.filter((avatar) => avatar.status === 'active')
  const avatarId = resolveAvatarReference(output.avatarId, activeAvatars)
  if (avatarId === undefined) return null

  const nextAvatarId = normalizeOptionalReference(output.nextAvatarId, activeAvatars)
  if (!isValidOptionalReference(output.nextAvatarId, nextAvatarId)) return null

  const suggestedAvatarId = normalizeOptionalReference(output.suggestedAvatarId, activeAvatars)
  if (!isValidOptionalReference(output.suggestedAvatarId, suggestedAvatarId)) return null

  const activeAvatarId = normalizeOptionalReference(
    output.stateUpdate.activeAvatarId,
    activeAvatars,
  )

  const unlockAvatarIds =
    output.unlockAvatarIds !== undefined
      ? output.unlockAvatarIds
          .map((candidate) => resolveAvatarReference(candidate, activeAvatars))
          .filter((candidate): candidate is string => candidate !== undefined)
      : undefined

  return {
    ...output,
    avatarId,
    ...(nextAvatarId !== undefined ? { nextAvatarId } : {}),
    ...(suggestedAvatarId !== undefined ? { suggestedAvatarId } : {}),
    ...(unlockAvatarIds !== undefined ? { unlockAvatarIds } : {}),
    stateUpdate: {
      ...output.stateUpdate,
      ...(activeAvatarId !== undefined ? { activeAvatarId } : {}),
    },
  }
}

function normalizeOptionalReference(
  value: string | undefined,
  avatars: AvatarConfig[],
): string | undefined {
  if (value === undefined) return undefined
  return resolveAvatarReference(value, avatars)
}

function isValidOptionalReference(
  original: string | undefined,
  normalized: string | undefined,
): boolean {
  return original === undefined || normalized !== undefined
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

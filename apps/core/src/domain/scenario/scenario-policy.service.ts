import type { AvatarConfig } from '../avatar/avatar.types.js'
import type { ScenarioAvatarAvailabilityConfig } from './scenario.types.js'

export function resolveInitialUnlockedAvatarIds(
  availability: ScenarioAvatarAvailabilityConfig,
  avatars: AvatarConfig[],
): string[] {
  const hasPolicy =
    availability.initialAvatarIds.length > 0 ||
    (availability.unlockableAvatarIds !== undefined && availability.unlockableAvatarIds.length > 0)
  if (!hasPolicy)
    return avatars.filter((avatar) => avatar.status === 'active').map((avatar) => avatar.avatarId)

  return filterExistingAvatarIds(availability.initialAvatarIds, avatars)
}

function filterExistingAvatarIds(avatarIds: string[], avatars: AvatarConfig[]): string[] {
  const existingAvatarIds = new Set(avatars.map((avatar) => avatar.avatarId))
  return avatarIds.reduce<string[]>((resolvedAvatarIds, avatarId) => {
    if (existingAvatarIds.has(avatarId)) {
      resolvedAvatarIds.push(avatarId)
    }
    return resolvedAvatarIds
  }, [])
}

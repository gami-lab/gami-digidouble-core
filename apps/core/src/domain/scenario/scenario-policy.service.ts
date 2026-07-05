import type { AvatarConfig } from '../avatar/avatar.types.js'
import type { ScenarioAvatarAvailabilityConfig } from './scenario.types.js'

/**
 * Returns undefined when the scenario has no meaningful availability policy
 * (no initial or unlockable avatars declared), meaning every avatar is available —
 * as opposed to an empty array, which would lock out every avatar.
 */
export function resolveInitialUnlockedAvatarIds(
  availability: ScenarioAvatarAvailabilityConfig,
  avatars: AvatarConfig[],
): string[] | undefined {
  const hasPolicy =
    availability.initialAvatarIds.length > 0 ||
    (availability.unlockableAvatarIds !== undefined && availability.unlockableAvatarIds.length > 0)
  if (!hasPolicy) return undefined

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

import type { ScenarioAvatarAvailability } from '@gami/shared'

export function computeNextAvailability(
  current: ScenarioAvatarAvailability,
  avatarId: string,
  visible: boolean,
): ScenarioAvatarAvailability {
  const initial = current.initialAvatarIds
  const unlockable = current.unlockableAvatarIds ?? []
  const nextInitial = visible
    ? initial.includes(avatarId)
      ? initial
      : [...initial, avatarId]
    : initial.filter((id) => id !== avatarId)
  const nextUnlockable = visible
    ? unlockable.filter((id) => id !== avatarId)
    : unlockable.includes(avatarId)
      ? unlockable
      : [...unlockable, avatarId]
  return {
    initialAvatarIds: nextInitial,
    ...(nextUnlockable.length > 0 ? { unlockableAvatarIds: nextUnlockable } : {}),
  }
}

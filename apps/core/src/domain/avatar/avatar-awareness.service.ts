import type { AvatarConfig } from './avatar.types.js'
import type { AvatarAwarenessItem } from './persona-prompt.types.js'

export function buildAvatarAwareness(
  currentAvatar: AvatarConfig,
  scenarioAvatars: AvatarConfig[],
  unlockedAvatarIds: string[] | undefined,
): AvatarAwarenessItem[] {
  return scenarioAvatars
    .filter((avatar) => avatar.status === 'active' && avatar.avatarId !== currentAvatar.avatarId)
    .map((avatar) => ({
      name: avatar.name,
      ...(avatar.description !== undefined ? { description: avatar.description } : {}),
      ...extractPublicScope(avatar),
      availability:
        unlockedAvatarIds === undefined || unlockedAvatarIds.includes(avatar.avatarId)
          ? 'available'
          : 'locked',
    }))
}

function extractPublicScope(avatar: AvatarConfig): { scope?: string } {
  const scope = avatar.config['scope']
  return typeof scope === 'string' && scope.trim().length > 0 ? { scope: scope.trim() } : {}
}

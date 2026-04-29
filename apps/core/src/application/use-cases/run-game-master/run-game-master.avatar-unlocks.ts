import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { Session } from '../../../domain/conversation/session.types.js'
import type {
  GameMasterInput,
  GameMasterOutput,
} from '../../../domain/game-master/game-master.types.js'

export function toGameMasterAvailableAvatars(
  avatars: AvatarConfig[],
  session: Session | null,
): GameMasterInput['context']['availableAvatars'] {
  return avatars
    .filter((avatar) => avatar.status === 'active')
    .map((avatar) => toAvailableAvatar(avatar, session))
}

export function resolveAvatarUnlocks(
  session: Session | null,
  avatars: AvatarConfig[],
  output: GameMasterOutput,
): { nextUnlockedAvatarIds: string[]; newlyUnlockedAvatarIds: string[] } | null {
  if (session?.unlockedAvatarIds === undefined || output.unlockAvatarIds === undefined) {
    return null
  }

  const activeAvatarIds = new Set(
    avatars.filter((avatar) => avatar.status === 'active').map((avatar) => avatar.avatarId),
  )
  const knownUnlockedIds = new Set(session.unlockedAvatarIds)
  const newlyUnlockedAvatarIds = [
    ...new Set(
      output.unlockAvatarIds.filter(
        (avatarId) => activeAvatarIds.has(avatarId) && !knownUnlockedIds.has(avatarId),
      ),
    ),
  ]

  if (newlyUnlockedAvatarIds.length === 0) return null

  return {
    nextUnlockedAvatarIds: [...session.unlockedAvatarIds, ...newlyUnlockedAvatarIds],
    newlyUnlockedAvatarIds,
  }
}

function toAvailableAvatar(
  avatar: AvatarConfig,
  session: Session | null,
): GameMasterInput['context']['availableAvatars'][number] {
  return {
    avatarId: avatar.avatarId,
    name: avatar.name,
    ...(avatar.description !== undefined ? { description: avatar.description } : {}),
    ...extractScope(avatar.config),
    ...buildAvailability(session, avatar.avatarId),
  }
}

function extractScope(config: Record<string, unknown>): { scope?: string } {
  const scope = config['scope']
  return typeof scope === 'string' && scope.trim().length > 0 ? { scope: scope.trim() } : {}
}

function buildAvailability(
  session: Session | null,
  avatarId: string,
): { availability?: 'available' | 'locked' } {
  if (session?.unlockedAvatarIds === undefined) return {}
  return {
    availability: session.unlockedAvatarIds.includes(avatarId) ? 'available' : 'locked',
  }
}

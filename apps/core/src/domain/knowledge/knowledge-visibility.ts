import type { KnowledgeVisibilityPolicy } from './knowledge.types.js'

export type KnowledgeVisibilitySelection = {
  visibilityPolicy: KnowledgeVisibilityPolicy
  visibleToAvatarIds?: string[]
}

export function buildKnowledgeVisibilitySelection(
  visibilityPolicy: KnowledgeVisibilityPolicy,
  visibleToAvatarIds: string[] | undefined,
): KnowledgeVisibilitySelection {
  return { visibilityPolicy, ...(visibleToAvatarIds !== undefined ? { visibleToAvatarIds } : {}) }
}

export function normalizeVisibleToAvatarIds(
  visibleToAvatarIds: string[] | undefined,
): string[] | undefined {
  if (visibleToAvatarIds === undefined) return undefined

  const normalized = visibleToAvatarIds
    .map((avatarId) => avatarId.trim())
    .filter((avatarId) => avatarId.length > 0)

  return normalized.length > 0 ? normalized : undefined
}

export function normalizeKnowledgeVisibilitySelection(
  selection: KnowledgeVisibilitySelection,
): KnowledgeVisibilitySelection {
  const visibleToAvatarIds = normalizeVisibleToAvatarIds(selection.visibleToAvatarIds)

  switch (selection.visibilityPolicy) {
    case 'all':
      return { visibilityPolicy: 'all' }
    case 'none':
      return { visibilityPolicy: 'none' }
    case 'avatars':
      return {
        visibilityPolicy: 'avatars',
        ...(visibleToAvatarIds !== undefined ? { visibleToAvatarIds } : {}),
      }
    default:
      throw new Error('Invalid knowledge visibility policy.')
  }
}

export function getKnowledgeVisibilityValidationError(
  selection: KnowledgeVisibilitySelection,
): string | null {
  if (selection.visibilityPolicy === 'avatars' && selection.visibleToAvatarIds === undefined) {
    return 'visibleToAvatarIds must contain at least one avatar when visibilityPolicy is avatars.'
  }

  return null
}

export function isKnowledgeVisibleToAvatar(
  selection: KnowledgeVisibilitySelection,
  activeAvatarId: string | undefined,
  bypassVisibilityFilter: boolean,
): boolean {
  if (bypassVisibilityFilter) return true

  const normalized = normalizeKnowledgeVisibilitySelection(selection)

  if (normalized.visibilityPolicy === 'none') return false

  if (normalized.visibilityPolicy === 'avatars') {
    if (normalized.visibleToAvatarIds === undefined) return false
    if (activeAvatarId === undefined) return false
    return normalized.visibleToAvatarIds.includes(activeAvatarId)
  }

  return true
}

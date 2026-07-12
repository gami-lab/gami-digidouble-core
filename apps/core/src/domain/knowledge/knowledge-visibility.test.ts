import { describe, expect, it } from 'vitest'
import {
  getKnowledgeVisibilityValidationError,
  isKnowledgeVisibleToAvatar,
  normalizeKnowledgeVisibilitySelection,
  normalizeVisibleToAvatarIds,
} from './knowledge-visibility.js'

describe('knowledge visibility helpers', () => {
  it('normalizes avatar ids by trimming blanks and removing empties', () => {
    expect(normalizeVisibleToAvatarIds([' avatar_1 ', '', 'avatar_2'])).toEqual([
      'avatar_1',
      'avatar_2',
    ])
    expect(normalizeVisibleToAvatarIds(['  '])).toBeUndefined()
  })

  it('infers avatar-scoped visibility from legacy ids-only selections when requested', () => {
    expect(
      normalizeKnowledgeVisibilitySelection(
        { visibleToAvatarIds: ['avatar_1'] },
        { inferAvatarPolicyFromIds: true },
      ),
    ).toEqual({
      visibilityPolicy: 'avatars',
      visibleToAvatarIds: ['avatar_1'],
    })
  })

  it('clears stale avatar ids for all and none policies', () => {
    expect(
      normalizeKnowledgeVisibilitySelection({
        visibilityPolicy: 'all',
        visibleToAvatarIds: ['avatar_1'],
      }),
    ).toEqual({ visibilityPolicy: 'all' })

    expect(
      normalizeKnowledgeVisibilitySelection({
        visibilityPolicy: 'none',
        visibleToAvatarIds: ['avatar_1'],
      }),
    ).toEqual({ visibilityPolicy: 'none' })
  })

  it('requires at least one avatar for avatars policy', () => {
    expect(getKnowledgeVisibilityValidationError({ visibilityPolicy: 'avatars' })).toBe(
      'visibleToAvatarIds must contain at least one avatar when visibilityPolicy is avatars.',
    )
  })

  it('treats explicit all with stale ids as visible to every avatar', () => {
    expect(
      isKnowledgeVisibleToAvatar(
        {
          visibilityPolicy: 'all',
          visibleToAvatarIds: ['avatar_hidden'],
        },
        'avatar_any',
        false,
      ),
    ).toBe(true)
  })

  it('treats avatar-scoped visibility without ids as hidden by default', () => {
    expect(isKnowledgeVisibleToAvatar({ visibilityPolicy: 'avatars' }, 'avatar_1', false)).toBe(
      false,
    )
  })
})

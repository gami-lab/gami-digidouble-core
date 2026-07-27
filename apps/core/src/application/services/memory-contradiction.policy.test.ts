import { describe, expect, it } from 'vitest'
import type { MemoryFactRecord } from '../../domain/memory/memory.types.js'
import { isUnsupportedContradictedAvatarClaim } from './memory-contradiction.policy.js'

const fact: MemoryFactRecord = {
  category: 'context',
  key: 'mona_current_location',
  value: 'with grandfather',
}

function message(
  role: 'user' | 'avatar',
  content: string,
  index: number,
): { role: 'user' | 'avatar'; createdAt: string; content: string } {
  return {
    role,
    content,
    createdAt: `2026-05-06T10:00:0${String(index)}.000Z`,
  }
}

describe('isUnsupportedContradictedAvatarClaim', () => {
  it('rejects a contradicted Avatar claim when the conversation uses natural wording', () => {
    expect(
      isUnsupportedContradictedAvatarClaim(
        fact,
        [
          message('user', 'Where is Mona now?', 0),
          message('avatar', 'Mona stayed with her grandfather.', 1),
          message('user', 'Your answer is contradictory.', 2),
        ],
        undefined,
      ),
    ).toBe(true)
  })

  it('keeps a claim when a later user message explicitly supports it', () => {
    expect(
      isUnsupportedContradictedAvatarClaim(
        fact,
        [
          message('avatar', 'Mona stayed with her grandfather.', 0),
          message('user', 'Yes, Mona was with grandfather.', 1),
          message('user', 'Your answer is contradictory.', 2),
        ],
        undefined,
      ),
    ).toBe(false)
  })

  it('keeps an otherwise unsupported claim when verified context supports it', () => {
    expect(
      isUnsupportedContradictedAvatarClaim(
        fact,
        [
          message('avatar', 'Mona stayed with her grandfather.', 0),
          message('user', 'Your answer is contradictory.', 1),
        ],
        [{ source: 'canonical', content: 'Mona stayed with her grandfather.' }],
      ),
    ).toBe(false)
  })
})

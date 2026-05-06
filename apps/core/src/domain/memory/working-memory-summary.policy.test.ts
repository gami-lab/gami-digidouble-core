import { describe, expect, it } from 'vitest'
import {
  buildAvatarWorkingMemorySummary,
  buildSessionWorkingMemorySummary,
} from './working-memory-summary.policy.js'

describe('working-memory-summary policy', () => {
  it('returns an empty-state session summary when there are no messages', () => {
    expect(buildSessionWorkingMemorySummary([])).toBe('No exchanged messages yet.')
  })

  it('builds a session summary from the latest six user/avatar messages', () => {
    const summary = buildSessionWorkingMemorySummary([
      { role: 'system', content: 'ignored' },
      { role: 'user', content: 'one' },
      { role: 'avatar', content: 'two' },
      { role: 'user', content: 'three' },
      { role: 'avatar', content: 'four' },
      { role: 'user', content: 'five' },
      { role: 'avatar', content: 'six' },
      { role: 'user', content: 'seven' },
    ])

    expect(summary).toContain('Conversation turns: user=4, avatar=3.')
    expect(summary).toContain(
      'avatar: two | user: three | avatar: four | user: five | avatar: six | user: seven',
    )
    expect(summary).not.toContain('ignored')
    expect(summary).not.toContain('user: one')
  })

  it('builds an avatar summary from the latest four user/avatar messages', () => {
    const summary = buildAvatarWorkingMemorySummary(
      [
        { role: 'user', content: 'one' },
        { role: 'avatar', content: 'two' },
        { role: 'user', content: 'three' },
        { role: 'avatar', content: 'four' },
        { role: 'user', content: 'five' },
      ],
      'avatar_1',
    )

    expect(summary).toBe(
      'Avatar avatar_1 recent dialogue context: avatar: two | user: three | avatar: four | user: five.',
    )
  })

  it('returns a stable avatar summary when there is no dialogue yet', () => {
    expect(buildAvatarWorkingMemorySummary([], 'avatar_1')).toBe(
      'Avatar avatar_1 recent dialogue context: none.',
    )
  })

  it('compacts whitespace and truncates long snippets', () => {
    const summary = buildAvatarWorkingMemorySummary(
      [
        {
          role: 'user',
          content: `  ${'x'.repeat(230)}\n\nnext line  `,
        },
      ],
      'avatar_1',
    )

    expect(summary).toContain(`${'x'.repeat(220)}...`)
    expect(summary).not.toContain('\n')
  })
})

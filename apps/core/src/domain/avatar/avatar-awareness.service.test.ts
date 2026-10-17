import { describe, expect, it } from 'vitest'
import { makeAvatarConfig } from './avatar.fixtures.js'
import { buildAvatarAwareness } from './avatar-awareness.service.js'

const current = makeAvatarConfig({ avatarId: 'avatar_current', name: 'Current' })
const unlocked = makeAvatarConfig({ avatarId: 'avatar_unlocked', name: 'Unlocked' })
const locked = makeAvatarConfig({ avatarId: 'avatar_locked', name: 'Locked' })
const inactive = makeAvatarConfig({
  avatarId: 'avatar_inactive',
  name: 'Inactive',
  status: 'archived',
})

describe('buildAvatarAwareness', () => {
  it('marks other active Avatars available only when the session has unlocked them', () => {
    const awareness = buildAvatarAwareness(
      current,
      [current, unlocked, locked, inactive],
      ['avatar_current', 'avatar_unlocked'],
    )

    expect(awareness.map(({ name, availability }) => ({ name, availability }))).toEqual([
      { name: 'Unlocked', availability: 'available' },
      { name: 'Locked', availability: 'locked' },
    ])
  })

  it('marks every other Avatar locked when the session has nothing unlocked', () => {
    const awareness = buildAvatarAwareness(current, [current, unlocked], [])

    expect(awareness).toMatchObject([{ name: 'Unlocked', availability: 'locked' }])
  })
})

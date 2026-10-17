import { describe, expect, it } from 'vitest'
import { makeAvatarConfig } from '../avatar/avatar.fixtures.js'
import { resolveInitialUnlockedAvatarIds } from './scenario-policy.service.js'

const guide = makeAvatarConfig({ avatarId: 'avatar_guide' })
const witness = makeAvatarConfig({ avatarId: 'avatar_witness' })
const retired = makeAvatarConfig({ avatarId: 'avatar_retired', status: 'archived' })

describe('resolveInitialUnlockedAvatarIds', () => {
  it('unlocks every active Avatar when the scenario declares no availability policy', () => {
    expect(
      resolveInitialUnlockedAvatarIds({ initialAvatarIds: [] }, [guide, witness, retired]),
    ).toEqual(['avatar_guide', 'avatar_witness'])
  })

  it('treats an empty unlockable list as no policy', () => {
    expect(
      resolveInitialUnlockedAvatarIds({ initialAvatarIds: [], unlockableAvatarIds: [] }, [guide]),
    ).toEqual(['avatar_guide'])
  })

  it('unlocks only the declared initial Avatars when a policy exists', () => {
    expect(
      resolveInitialUnlockedAvatarIds(
        { initialAvatarIds: ['avatar_guide'], unlockableAvatarIds: ['avatar_witness'] },
        [guide, witness],
      ),
    ).toEqual(['avatar_guide'])
  })

  it('starts with nothing unlocked when only unlockable Avatars are declared', () => {
    expect(
      resolveInitialUnlockedAvatarIds(
        { initialAvatarIds: [], unlockableAvatarIds: ['avatar_witness'] },
        [guide, witness],
      ),
    ).toEqual([])
  })

  it('drops initial Avatar IDs that do not belong to the scenario', () => {
    expect(
      resolveInitialUnlockedAvatarIds({ initialAvatarIds: ['avatar_guide', 'avatar_gone'] }, [
        guide,
      ]),
    ).toEqual(['avatar_guide'])
  })
})

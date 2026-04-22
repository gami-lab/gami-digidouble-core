import { describe, expect, it } from 'vitest'
import type { GameMasterState } from './game-master.types.js'
import { reduceGmState } from './gm-state-reducer.js'

function makeState(overrides: Partial<GameMasterState> = {}): GameMasterState {
  return {
    progression: 'intro',
    topicsCovered: ['plastic'],
    interactionCount: 2,
    ...overrides,
  }
}

describe('reduceGmState', () => {
  it('always increments interactionCount', () => {
    const result = reduceGmState(makeState(), { interactionIncrement: 1 })

    expect(result.interactionCount).toBe(3)
  })

  it('appends [advanced] progression marker when progression increases', () => {
    const result = reduceGmState(makeState({ progression: 'intro' }), {
      progression: 'increase',
      interactionIncrement: 1,
    })

    expect(result.progression).toBe('intro [advanced]')
  })

  it('does not append duplicate [advanced] marker', () => {
    const result = reduceGmState(makeState({ progression: 'intro [advanced]' }), {
      progression: 'increase',
      interactionIncrement: 1,
    })

    expect(result.progression).toBe('intro [advanced]')
  })

  it('adds topicCovered when present', () => {
    const result = reduceGmState(makeState(), {
      topicCovered: 'ocean_cleanup',
      interactionIncrement: 1,
    })

    expect(result.topicsCovered).toEqual(['plastic', 'ocean_cleanup'])
  })

  it('updates currentAvatarId when activeAvatarId is provided', () => {
    const result = reduceGmState(makeState({ currentAvatarId: 'avatar_1' }), {
      activeAvatarId: 'avatar_2',
      interactionIncrement: 1,
    })

    expect(result.currentAvatarId).toBe('avatar_2')
  })
})

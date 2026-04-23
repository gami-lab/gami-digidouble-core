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

  it('leaves all fields unchanged when stateUpdate has no optional fields', () => {
    const state = makeState()
    const result = reduceGmState(state, { interactionIncrement: 1 })

    expect(result.progression).toBe(state.progression)
    expect(result.topicsCovered).toEqual(state.topicsCovered)
    expect(result.currentAvatarId).toBeUndefined()
    expect(result.interactionCount).toBe(state.interactionCount + 1)
  })

  it('does not mutate the input state', () => {
    const original: GameMasterState = {
      progression: 'intro',
      topicsCovered: ['plastic'],
      interactionCount: 2,
    }
    const topicsRef = original.topicsCovered

    reduceGmState(original, { topicCovered: 'ocean', interactionIncrement: 1 })

    expect(original.interactionCount).toBe(2)
    expect(original.topicsCovered).toBe(topicsRef)
    expect(original.topicsCovered).toEqual(['plastic'])
  })
})

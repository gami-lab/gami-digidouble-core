import { describe, expect, it } from 'vitest'
import type { GameMasterState, ProgressionUpdate, RoutingDecision } from './game-master.types.js'
import { reduceGmState } from './gm-state-reducer.js'

function makeState(overrides: Partial<GameMasterState> = {}): GameMasterState {
  return {
    progression: 'intro',
    topicsCovered: ['plastic'],
    interactionCount: 2,
    ...overrides,
  }
}

const NONE: ProgressionUpdate = { progression: 'none' }
const INCREASE: ProgressionUpdate = { progression: 'increase' }

describe('reduceGmState', () => {
  it('always increments interactionCount', () => {
    const result = reduceGmState(makeState(), { progressionUpdate: NONE })

    expect(result.interactionCount).toBe(3)
  })

  it('appends [advanced] progression marker when progression increases', () => {
    const result = reduceGmState(makeState({ progression: 'intro' }), {
      progressionUpdate: INCREASE,
    })

    expect(result.progression).toBe('intro [advanced]')
  })

  it('does not append duplicate [advanced] marker', () => {
    const result = reduceGmState(makeState({ progression: 'intro [advanced]' }), {
      progressionUpdate: INCREASE,
    })

    expect(result.progression).toBe('intro [advanced]')
  })

  it('never appends to topicsCovered — covered-topic tracking is owned by memory compaction', () => {
    const result = reduceGmState(makeState(), { progressionUpdate: NONE })

    expect(result.topicsCovered).toEqual(['plastic'])
  })

  it('updates currentAvatarId when routing switches to another avatar', () => {
    const routing: RoutingDecision = { action: 'switch', avatarId: 'avatar_2' }
    const result = reduceGmState(makeState({ currentAvatarId: 'avatar_1' }), {
      progressionUpdate: NONE,
      routing,
    })

    expect(result.currentAvatarId).toBe('avatar_2')
  })

  it('updates currentAvatarId when routing unlocks and switches', () => {
    const routing: RoutingDecision = { action: 'unlock_and_switch', avatarId: 'avatar_3' }
    const result = reduceGmState(makeState({ currentAvatarId: 'avatar_1' }), {
      progressionUpdate: NONE,
      routing,
    })

    expect(result.currentAvatarId).toBe('avatar_3')
  })

  it('leaves currentAvatarId unchanged for stay/suggest/unlock routing', () => {
    const routing: RoutingDecision = { action: 'suggest', avatarId: 'avatar_2' }
    const result = reduceGmState(makeState({ currentAvatarId: 'avatar_1' }), {
      progressionUpdate: NONE,
      routing,
    })

    expect(result.currentAvatarId).toBe('avatar_1')
  })

  it('leaves all fields unchanged when there is no routing or progression change', () => {
    const state = makeState()
    const result = reduceGmState(state, { progressionUpdate: NONE })

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

    reduceGmState(original, { progressionUpdate: NONE })

    expect(original.interactionCount).toBe(2)
    expect(original.topicsCovered).toBe(topicsRef)
    expect(original.topicsCovered).toEqual(['plastic'])
  })
})

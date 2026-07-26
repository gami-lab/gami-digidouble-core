import { describe, expect, it } from 'vitest'
import type { GameMasterState, ProgressionUpdate } from './game-master.types.js'
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
  it('preserves interactionCount for application-owned updates', () => {
    const result = reduceGmState(makeState(), { progressionUpdate: NONE })

    expect(result.interactionCount).toBe(2)
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

  it('leaves all fields unchanged when there is no routing or progression change', () => {
    const state = makeState()
    const result = reduceGmState(state, { progressionUpdate: NONE })

    expect(result.progression).toBe(state.progression)
    expect(result.topicsCovered).toEqual(state.topicsCovered)
    expect(result.interactionCount).toBe(state.interactionCount)
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

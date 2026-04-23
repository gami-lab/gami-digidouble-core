import { describe, expect, it } from 'vitest'
import type { GameMasterState } from './game-master.types.js'
import { evaluateTriggers } from './trigger-engine.js'

function makeState(overrides?: Partial<GameMasterState>): GameMasterState {
  return {
    progression: 'in_progress',
    topicsCovered: [],
    interactionCount: 1,
    ...overrides,
  }
}

describe('evaluateTriggers -> turn_threshold', () => {
  it('fires every default threshold multiple and never at 0', () => {
    expect(evaluateTriggers(makeState({ interactionCount: 0 }))).toBeNull()
    expect(evaluateTriggers(makeState({ interactionCount: 5 }))).toBe('turn_threshold')
    expect(evaluateTriggers(makeState({ interactionCount: 10 }))).toBe('turn_threshold')
  })

  it('does not fire when interactionCount is below default threshold', () => {
    expect(evaluateTriggers(makeState({ interactionCount: 4 }))).toBeNull()
  })

  it('uses custom turn threshold when provided', () => {
    const trigger = evaluateTriggers(makeState({ interactionCount: 6 }), {
      turnThreshold: 3,
    })

    expect(trigger).toBe('turn_threshold')
  })

  it('fires at exactly the custom threshold', () => {
    const trigger = evaluateTriggers(makeState({ interactionCount: 3 }), {
      turnThreshold: 3,
    })

    expect(trigger).toBe('turn_threshold')
  })
})

describe('evaluateTriggers -> topic_repeat', () => {
  it('fires when any topic reaches the default repeat count', () => {
    const trigger = evaluateTriggers(
      makeState({
        interactionCount: 4,
        topicsCovered: ['plastic', 'water', 'plastic', 'plastic'],
      }),
    )

    expect(trigger).toBe('topic_repeat')
  })

  it('does not fire when no topic reaches the default repeat count', () => {
    const trigger = evaluateTriggers(
      makeState({
        interactionCount: 4,
        topicsCovered: ['a', 'a', 'b', 'b'],
      }),
    )

    expect(trigger).toBeNull()
  })

  it('uses custom max topic repeat count when provided', () => {
    const trigger = evaluateTriggers(
      makeState({
        interactionCount: 4,
        topicsCovered: ['plastic', 'water', 'plastic'],
      }),
      { maxTopicRepeatCount: 2 },
    )

    expect(trigger).toBe('topic_repeat')
  })
})

describe('evaluateTriggers -> progression_stalled', () => {
  it('fires when interaction count reaches threshold and progression is empty', () => {
    const trigger = evaluateTriggers(
      makeState({
        interactionCount: 8,
        progression: '',
      }),
    )

    expect(trigger).toBe('progression_stalled')
  })

  it('fires when interaction count reaches threshold and progression is none', () => {
    const trigger = evaluateTriggers(
      makeState({
        interactionCount: 8,
        progression: 'none',
      }),
    )

    expect(trigger).toBe('progression_stalled')
  })

  it('does not fire when progression has text', () => {
    const trigger = evaluateTriggers(
      makeState({
        interactionCount: 8,
        progression: 'some progress',
      }),
    )

    expect(trigger).toBeNull()
  })

  it('does not fire when interaction count is below threshold', () => {
    const trigger = evaluateTriggers(
      makeState({
        interactionCount: 7,
        progression: '',
      }),
    )

    expect(trigger).toBeNull()
  })

  it('uses custom progression threshold when provided', () => {
    const trigger = evaluateTriggers(
      makeState({
        interactionCount: 3,
        progression: 'none',
      }),
      { maxTurnsWithoutProgression: 3 },
    )

    expect(trigger).toBe('progression_stalled')
  })
})

describe('evaluateTriggers -> ordering and null behavior', () => {
  it('returns turn_threshold first when multiple conditions match', () => {
    const trigger = evaluateTriggers(
      makeState({
        interactionCount: 5,
        progression: 'none',
        topicsCovered: ['plastic', 'plastic', 'plastic'],
      }),
    )

    expect(trigger).toBe('turn_threshold')
  })

  it('returns topic_repeat before progression_stalled when both match', () => {
    const trigger = evaluateTriggers(
      makeState({
        interactionCount: 8,
        progression: 'none',
        topicsCovered: ['plastic', 'plastic', 'plastic'],
      }),
    )

    expect(trigger).toBe('topic_repeat')
  })

  it('returns null when no trigger condition matches', () => {
    const trigger = evaluateTriggers(
      makeState({
        interactionCount: 7,
        progression: 'progressing',
        topicsCovered: ['plastic', 'water'],
      }),
    )

    expect(trigger).toBeNull()
  })

  it('returns null for zero state (no thresholds reached)', () => {
    const trigger = evaluateTriggers({
      progression: '',
      topicsCovered: [],
      interactionCount: 0,
    })

    expect(trigger).toBeNull()
  })
})

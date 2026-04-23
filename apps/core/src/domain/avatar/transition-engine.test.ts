import { describe, expect, it } from 'vitest'
import type { GameMasterState } from '../game-master/game-master.types.js'
import type { AvatarTransitionRule } from './avatar-transition.types.js'
import { evaluateTransitionRules } from './transition-engine.js'

function makeState(overrides?: Partial<GameMasterState>): GameMasterState {
  return {
    progression: 'in_progress',
    topicsCovered: [],
    interactionCount: 1,
    ...overrides,
  }
}

function makeProgressionRule(fromAvatarId: string, toAvatarId: string): AvatarTransitionRule {
  return { fromAvatarId, toAvatarId, trigger: 'progression' }
}

function makeTopicRepeatRule(
  fromAvatarId: string,
  toAvatarId: string,
  topic: string,
): AvatarTransitionRule {
  return { fromAvatarId, toAvatarId, trigger: 'topic_repeat', topic }
}

describe('evaluateTransitionRules', () => {
  it('1. returns [] when rules list is empty', () => {
    const result = evaluateTransitionRules('avatar-1', makeState(), [], 'progression')
    expect(result).toEqual([])
  })

  it('2. returns [] when no rule has a matching fromAvatarId', () => {
    const rules = [makeProgressionRule('avatar-2', 'avatar-3')]
    const result = evaluateTransitionRules('avatar-1', makeState(), rules, 'progression')
    expect(result).toEqual([])
  })

  it('3. progression rule matches when activeTrigger is progression', () => {
    const rules = [makeProgressionRule('avatar-1', 'avatar-2')]
    const result = evaluateTransitionRules('avatar-1', makeState(), rules, 'progression')
    expect(result).toHaveLength(1)
    expect(result[0]?.toAvatarId).toBe('avatar-2')
    expect(result[0]?.reason).toBe('progression_rule:avatar-1→avatar-2')
  })

  it('4. progression rule does not match when activeTrigger is null', () => {
    const rules = [makeProgressionRule('avatar-1', 'avatar-2')]
    const result = evaluateTransitionRules('avatar-1', makeState(), rules, null)
    expect(result).toEqual([])
  })

  it('5. topic_repeat rule matches when topic is covered and activeTrigger is topic_repeat', () => {
    const rules = [makeTopicRepeatRule('avatar-1', 'avatar-2', 'plastic')]
    const state = makeState({ topicsCovered: ['plastic', 'water'] })
    const result = evaluateTransitionRules('avatar-1', state, rules, 'topic_repeat')
    expect(result).toHaveLength(1)
    expect(result[0]?.toAvatarId).toBe('avatar-2')
    expect(result[0]?.reason).toBe('topic_rule:plastic:avatar-1→avatar-2')
  })

  it('6. topic_repeat rule does not match when topic is NOT covered', () => {
    const rules = [makeTopicRepeatRule('avatar-1', 'avatar-2', 'plastic')]
    const state = makeState({ topicsCovered: ['water', 'air'] })
    const result = evaluateTransitionRules('avatar-1', state, rules, 'topic_repeat')
    expect(result).toEqual([])
  })

  it('7. topic_repeat rule does not match when activeTrigger is not topic_repeat', () => {
    const rules = [makeTopicRepeatRule('avatar-1', 'avatar-2', 'plastic')]
    const state = makeState({ topicsCovered: ['plastic'] })
    const result = evaluateTransitionRules('avatar-1', state, rules, 'progression')
    expect(result).toEqual([])
  })

  it('8. multiple eligible rules are all returned', () => {
    const rules = [
      makeTopicRepeatRule('avatar-1', 'avatar-2', 'plastic'),
      makeTopicRepeatRule('avatar-1', 'avatar-3', 'water'),
      makeProgressionRule('avatar-1', 'avatar-4'),
    ]
    const state = makeState({ topicsCovered: ['plastic', 'water'] })
    const result = evaluateTransitionRules('avatar-1', state, rules, 'topic_repeat')
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.toAvatarId)).toEqual(['avatar-2', 'avatar-3'])
  })

  it('9. wrong fromAvatarId in rule is not returned', () => {
    const rules = [makeProgressionRule('avatar-99', 'avatar-2')]
    const result = evaluateTransitionRules('avatar-1', makeState(), rules, 'progression')
    expect(result).toEqual([])
  })

  it('10. currentAvatarId undefined → no rule matches (no wildcard in Phase A)', () => {
    const rules = [makeProgressionRule('avatar-1', 'avatar-2')]
    const result = evaluateTransitionRules(undefined, makeState(), rules, 'progression')
    expect(result).toEqual([])
  })
})

describe('evaluateTransitionRules edge cases', () => {
  it('manual trigger type is never returned by evaluateTransitionRules', () => {
    const rules: AvatarTransitionRule[] = [
      { fromAvatarId: 'avatar-1', toAvatarId: 'avatar-2', trigger: 'manual' },
    ]
    const result = evaluateTransitionRules('avatar-1', makeState(), rules, 'progression')
    expect(result).toEqual([])
  })

  it('matching fromAvatarId without activeTrigger returns no transitions', () => {
    const rules: AvatarTransitionRule[] = [
      makeProgressionRule('avatar-1', 'avatar-2'),
      makeTopicRepeatRule('avatar-1', 'avatar-3', 'plastic'),
    ]
    const state = makeState({ topicsCovered: ['plastic'] })
    const result = evaluateTransitionRules('avatar-1', state, rules, null)
    expect(result).toEqual([])
  })

  it('returns both progression rules when they share fromAvatarId and activeTrigger is progression', () => {
    const rules: AvatarTransitionRule[] = [
      makeProgressionRule('avatar-1', 'avatar-2'),
      makeProgressionRule('avatar-1', 'avatar-3'),
    ]
    const result = evaluateTransitionRules('avatar-1', makeState(), rules, 'progression')
    expect(result.map((rule) => rule.toAvatarId)).toEqual(['avatar-2', 'avatar-3'])
  })

  it('treats empty topic in topic_repeat rule as non-matching', () => {
    const rules: AvatarTransitionRule[] = [
      { fromAvatarId: 'avatar-1', toAvatarId: 'avatar-2', trigger: 'topic_repeat', topic: '' },
    ]
    const state = makeState({ topicsCovered: [''] })
    const result = evaluateTransitionRules('avatar-1', state, rules, 'topic_repeat')
    expect(result).toEqual([])
  })

  it('topic_repeat results appear before progression results', () => {
    const rules = [
      makeProgressionRule('avatar-1', 'avatar-p'),
      makeTopicRepeatRule('avatar-1', 'avatar-t', 'plastic'),
    ]
    const state = makeState({ topicsCovered: ['plastic'] })
    // activeTrigger must be topic_repeat to match topic rule, progression won't match here
    const result = evaluateTransitionRules('avatar-1', state, rules, 'topic_repeat')
    expect(result).toHaveLength(1)
    expect(result[0]?.toAvatarId).toBe('avatar-t')
  })
})

import type { GameMasterState } from '../game-master/game-master.types.js'
import type { AvatarTransitionRule, EligibleTransition } from './avatar-transition.types.js'

/**
 * Evaluates avatar transition rules against the current GM state and active trigger.
 *
 * Returns all eligible transitions ordered by specificity (topic_repeat before progression).
 * Never throws — returns [] on any unexpected or non-matching input.
 *
 * 'manual' rules are never returned; manual transitions are handled by SwitchAvatarUseCase.
 */
export function evaluateTransitionRules(
  currentAvatarId: string | undefined,
  state: GameMasterState,
  rules: AvatarTransitionRule[],
  activeTrigger: 'progression' | 'topic_repeat' | null,
): EligibleTransition[] {
  if (!rules.length || currentAvatarId === undefined) {
    return []
  }

  const topicRepeatMatches: EligibleTransition[] = []
  const progressionMatches: EligibleTransition[] = []

  for (const rule of rules) {
    if (rule.fromAvatarId !== currentAvatarId || rule.trigger === 'manual') {
      continue
    }

    const transition = tryMatchRule(rule, state, activeTrigger)
    if (transition !== null) {
      if (rule.trigger === 'topic_repeat') {
        topicRepeatMatches.push(transition)
      } else {
        progressionMatches.push(transition)
      }
    }
  }

  return [...topicRepeatMatches, ...progressionMatches]
}

function tryMatchRule(
  rule: AvatarTransitionRule,
  state: GameMasterState,
  activeTrigger: 'progression' | 'topic_repeat' | null,
): EligibleTransition | null {
  if (rule.trigger === 'topic_repeat') {
    return tryMatchTopicRepeatRule(rule, state, activeTrigger)
  }
  return tryMatchProgressionRule(rule, activeTrigger)
}

function tryMatchTopicRepeatRule(
  rule: AvatarTransitionRule,
  state: GameMasterState,
  activeTrigger: 'progression' | 'topic_repeat' | null,
): EligibleTransition | null {
  if (
    activeTrigger !== 'topic_repeat' ||
    rule.topic === undefined ||
    rule.topic.trim().length === 0 ||
    !state.topicsCovered.includes(rule.topic)
  ) {
    return null
  }
  return {
    toAvatarId: rule.toAvatarId,
    reason: `topic_rule:${rule.topic}:${rule.fromAvatarId}→${rule.toAvatarId}`,
    rule,
  }
}

function tryMatchProgressionRule(
  rule: AvatarTransitionRule,
  activeTrigger: 'progression' | 'topic_repeat' | null,
): EligibleTransition | null {
  if (activeTrigger !== 'progression') {
    return null
  }
  return {
    toAvatarId: rule.toAvatarId,
    reason: `progression_rule:${rule.fromAvatarId}→${rule.toAvatarId}`,
    rule,
  }
}

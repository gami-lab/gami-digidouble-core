import type { GameMasterState } from './game-master.types.js'

export type TriggerReason =
  | 'turn_threshold'
  | 'topic_repeat'
  | 'progression_stalled'
  | 'avatar_unlock_evaluation'
  | 'session_start'
  | 'manual'

export type TriggerPolicy = {
  turnThreshold?: number
  maxTopicRepeatCount?: number
  maxTurnsWithoutProgression?: number
}

export const DEFAULT_TURN_THRESHOLD = 5
export const DEFAULT_MAX_TOPIC_REPEATS = 3
export const DEFAULT_MAX_TURNS_WITHOUT_PROGRESSION = 8

export function evaluateTriggers(
  state: GameMasterState,
  policy?: TriggerPolicy,
): TriggerReason | null {
  if (isTurnThresholdTriggered(state, policy)) {
    return 'turn_threshold'
  }

  if (isTopicRepeatTriggered(state, policy)) {
    return 'topic_repeat'
  }

  if (isProgressionStalledTriggered(state, policy)) {
    return 'progression_stalled'
  }

  return null
}

function isTurnThresholdTriggered(state: GameMasterState, policy?: TriggerPolicy): boolean {
  const turnThreshold = policy?.turnThreshold ?? DEFAULT_TURN_THRESHOLD
  return state.interactionCount > 0 && state.interactionCount % turnThreshold === 0
}

function isTopicRepeatTriggered(state: GameMasterState, policy?: TriggerPolicy): boolean {
  const maxTopicRepeats = policy?.maxTopicRepeatCount ?? DEFAULT_MAX_TOPIC_REPEATS
  return hasRepeatedTopic(state.topicsCovered, maxTopicRepeats)
}

function isProgressionStalledTriggered(state: GameMasterState, policy?: TriggerPolicy): boolean {
  const maxTurnsWithoutProgression =
    policy?.maxTurnsWithoutProgression ?? DEFAULT_MAX_TURNS_WITHOUT_PROGRESSION
  return (
    state.interactionCount >= maxTurnsWithoutProgression && isInitialProgression(state.progression)
  )
}

function hasRepeatedTopic(topicsCovered: string[], maxTopicRepeats: number): boolean {
  const counts = new Map<string, number>()

  for (const topic of topicsCovered) {
    const nextCount = (counts.get(topic) ?? 0) + 1
    if (nextCount >= maxTopicRepeats) {
      return true
    }
    counts.set(topic, nextCount)
  }

  return false
}

function isInitialProgression(progression: string): boolean {
  const normalizedProgression = progression.trim()
  return normalizedProgression === '' || normalizedProgression === 'none'
}

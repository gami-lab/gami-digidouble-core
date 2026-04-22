import type { GameMasterOutput, GameMasterState } from './game-master.types.js'

const NONE_PROGRESSION = 'none'
const INITIAL_ADVANCED_PROGRESSION = 'advanced'
const ADVANCED_MARKER = '[advanced]'

export function reduceGmState(
  current: GameMasterState,
  update: GameMasterOutput['stateUpdate'],
): GameMasterState {
  const nextProgression =
    update.progression === 'increase'
      ? buildIncreasedProgression(current.progression)
      : current.progression
  const nextTopicsCovered = hasText(update.topicCovered)
    ? [...current.topicsCovered, update.topicCovered.trim()]
    : [...current.topicsCovered]

  return {
    ...current,
    progression: nextProgression,
    topicsCovered: nextTopicsCovered,
    interactionCount: current.interactionCount + 1,
    ...(hasText(update.activeAvatarId) ? { currentAvatarId: update.activeAvatarId.trim() } : {}),
  }
}

function buildIncreasedProgression(progression: string): string {
  const current = progression.trim()
  if (current.length === 0 || current === NONE_PROGRESSION) {
    return INITIAL_ADVANCED_PROGRESSION
  }
  if (current.endsWith(ADVANCED_MARKER)) {
    return current
  }
  return `${current} ${ADVANCED_MARKER}`
}

function hasText(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

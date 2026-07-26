import type { GameMasterState, ProgressionUpdate } from './game-master.types.js'

const NONE_PROGRESSION = 'none'
const INITIAL_ADVANCED_PROGRESSION = 'advanced'
const ADVANCED_MARKER = '[advanced]'

export function reduceGmState(
  current: GameMasterState,
  update: { progressionUpdate: ProgressionUpdate },
): GameMasterState {
  const nextProgression =
    update.progressionUpdate.progression === 'increase'
      ? buildIncreasedProgression(current.progression)
      : current.progression
  return {
    ...current,
    progression: nextProgression,
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

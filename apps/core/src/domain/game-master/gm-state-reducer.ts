import type { GameMasterState, ProgressionUpdate, RoutingDecision } from './game-master.types.js'

const NONE_PROGRESSION = 'none'
const INITIAL_ADVANCED_PROGRESSION = 'advanced'
const ADVANCED_MARKER = '[advanced]'

export function reduceGmState(
  current: GameMasterState,
  update: { progressionUpdate: ProgressionUpdate; routing?: RoutingDecision },
): GameMasterState {
  const nextProgression =
    update.progressionUpdate.progression === 'increase'
      ? buildIncreasedProgression(current.progression)
      : current.progression
  const routedAvatarId = resolveRoutedAvatarId(update.routing)

  return {
    ...current,
    progression: nextProgression,
    ...(routedAvatarId !== undefined ? { currentAvatarId: routedAvatarId } : {}),
  }
}

/** Only `switch`/`unlock_and_switch` move orchestration focus to a new avatar. */
function resolveRoutedAvatarId(routing: RoutingDecision | undefined): string | undefined {
  if (routing === undefined) return undefined
  if (routing.action !== 'switch' && routing.action !== 'unlock_and_switch') return undefined
  return routing.avatarId
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

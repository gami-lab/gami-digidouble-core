import type {
  DialogueControl,
  GameMasterOrchestrationState,
  ProgressionUpdate,
  RetrievalPlan,
  RoutingDecision,
} from './game-master.types.js'

/**
 * Converts persisted pre-8.5 orchestration payloads into the current shape.
 * Memory fields and interaction increments are deliberately not copied.
 */
// eslint-disable-next-line complexity
export function normalizePersistedOrchestration(
  value: unknown,
): GameMasterOrchestrationState | undefined {
  const record = toPersistedRecord(value)
  if (record === null) return undefined

  const activeAvatarId = readText(record['activeAvatarId'])
  const generatedAfterTurn = readNumber(record['generatedAfterTurn'])
  const generatedAt = readText(record['generatedAt'])
  if (
    activeAvatarId === undefined ||
    generatedAfterTurn === undefined ||
    generatedAt === undefined
  ) {
    return undefined
  }

  const dialogueControl = readDialogueControl(record['dialogueControl']) ?? {
    mode: readLegacyDialogueMode(record),
    askFollowUp: false,
  }
  const retrievalPlan = readRetrievalPlan(record['retrievalPlan']) ?? { required: false }
  const progressionUpdate = readProgressionUpdate(record['progressionUpdate']) ??
    readProgressionUpdate(isRecord(record['stateUpdate']) ? record['stateUpdate'] : undefined) ?? {
      progression: 'none',
    }
  const routing = readRouting(record['routing']) ?? readLegacyRouting(record)
  const consumedAfterTurn = readNumber(record['consumedAfterTurn'])
  const consumedAt = readText(record['consumedAt'])
  const directorNotes = readText(record['directorNotes'])

  return {
    activeAvatarId,
    generatedAfterTurn,
    generatedAt,
    dialogueControl,
    retrievalPlan,
    ...(directorNotes !== undefined ? { directorNotes } : {}),
    ...(routing !== undefined ? { routing } : {}),
    progressionUpdate,
    ...(consumedAfterTurn !== undefined ? { consumedAfterTurn } : {}),
    ...(consumedAt !== undefined ? { consumedAt } : {}),
  }
}

function toPersistedRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown
    } catch {
      return null
    }
  }

  return isRecord(value) ? value : null
}

function readLegacyDialogueMode(value: Record<string, unknown>): DialogueControl['mode'] {
  const mode = readText(value['conversationMode'])
  if (mode === 'repair' || mode === 'transition' || mode === 'avatar_led') return mode
  if (mode === 'avatar_guided') return mode
  return 'user_led'
}

function readDialogueControl(value: unknown): DialogueControl | undefined {
  if (!isRecord(value)) return undefined
  const mode = readText(value['mode'])
  if (
    mode !== 'user_led' &&
    mode !== 'avatar_guided' &&
    mode !== 'avatar_led' &&
    mode !== 'repair' &&
    mode !== 'transition'
  ) {
    return undefined
  }
  return {
    mode,
    askFollowUp: typeof value['askFollowUp'] === 'boolean' ? value['askFollowUp'] : false,
  }
}

function readRetrievalPlan(value: unknown): RetrievalPlan | undefined {
  if (!isRecord(value) || typeof value['required'] !== 'boolean') return undefined
  const queries = readTextArray(value['queries'])
  const requiredFacts = readTextArray(value['requiredFacts'])
  return {
    required: value['required'],
    ...(queries !== undefined ? { queries } : {}),
    ...(requiredFacts !== undefined ? { requiredFacts } : {}),
  }
}

function readProgressionUpdate(value: unknown): ProgressionUpdate | undefined {
  if (!isRecord(value)) return undefined
  const progression = value['progression']
  if (progression !== 'none' && progression !== 'increase') return undefined
  const objectiveId = readText(value['objectiveId'])
  const reason = readText(value['reason'])
  return {
    progression,
    ...(objectiveId !== undefined ? { objectiveId } : {}),
    ...(reason !== undefined ? { reason } : {}),
  }
}

function readRouting(value: unknown): RoutingDecision | undefined {
  if (!isRecord(value)) return undefined
  const action = value['action']
  if (
    action !== 'stay' &&
    action !== 'suggest' &&
    action !== 'switch' &&
    action !== 'unlock' &&
    action !== 'unlock_and_switch'
  ) {
    return undefined
  }
  const avatarId = readText(value['avatarId'])
  const reason = readText(value['reason'])
  return {
    action,
    ...(avatarId !== undefined ? { avatarId } : {}),
    ...(reason !== undefined ? { reason } : {}),
  }
}

function readLegacyRouting(value: Record<string, unknown>): RoutingDecision | undefined {
  const stateUpdate = isRecord(value['stateUpdate']) ? value['stateUpdate'] : undefined
  const switchTarget = readText(stateUpdate?.['activeAvatarId']) ?? readText(value['nextAvatarId'])
  if (switchTarget !== undefined) return { action: 'switch', avatarId: switchTarget }

  const suggestedAvatarId = readText(value['suggestedAvatarId'])
  if (suggestedAvatarId !== undefined) {
    const reason = readText(value['suggestedAvatarReason'])
    return {
      action: 'suggest',
      avatarId: suggestedAvatarId,
      ...(reason !== undefined ? { reason } : {}),
    }
  }

  return undefined
}

function readTextArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items = value.filter((item): item is string => typeof item === 'string')
  return items.length > 0 ? items : undefined
}

function readText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

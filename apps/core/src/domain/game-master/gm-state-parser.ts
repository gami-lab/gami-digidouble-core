import type {
  DialogueControl,
  GameMasterOrchestrationState,
  ProgressionUpdate,
  RetrievalPlan,
  RetrievalScope,
  RoutingDecision,
} from './game-master.types.js'

const DIALOGUE_CONTROL_MODES = new Set<DialogueControl['mode']>([
  'user_led',
  'avatar_guided',
  'avatar_led',
  'repair',
  'transition',
])
const RETRIEVAL_SCOPES = new Set<RetrievalScope>([
  'avatar_memory',
  'world_context',
  'scenario_knowledge',
])
const ROUTING_ACTIONS = new Set<RoutingDecision['action']>([
  'stay',
  'suggest',
  'switch',
  'unlock',
  'unlock_and_switch',
])
const PROGRESSION_STATES = new Set<ProgressionUpdate['progression']>(['none', 'increase'])

/** Deserialize only the current JSONB orchestration shape. */
// eslint-disable-next-line complexity
export function parsePersistedGameMasterOrchestration(
  value: unknown,
): GameMasterOrchestrationState | undefined {
  if (!isRecord(value)) return undefined
  if (
    !hasOnlyKeys(value, [
      'generatedByCorrelationId',
      'activeAvatarId',
      'generatedAfterTurn',
      'generatedAt',
      'dialogueControl',
      'retrievalPlan',
      'directorNotes',
      'routing',
      'progressionUpdate',
      'consumedAfterTurn',
      'consumedAt',
    ])
  ) {
    return undefined
  }

  const activeAvatarId = readRequiredText(value['activeAvatarId'])
  const generatedAfterTurn = readRequiredInteger(value['generatedAfterTurn'])
  const generatedAt = readRequiredText(value['generatedAt'])
  const dialogueControl = readDialogueControl(value['dialogueControl'])
  const retrievalPlan = readRetrievalPlan(value['retrievalPlan'])
  const progressionUpdate = readProgressionUpdate(value['progressionUpdate'])
  if (
    activeAvatarId === undefined ||
    generatedAfterTurn === undefined ||
    generatedAt === undefined ||
    dialogueControl === undefined ||
    retrievalPlan === undefined ||
    progressionUpdate === undefined
  ) {
    return undefined
  }

  const generatedByCorrelationId = readOptionalText(value['generatedByCorrelationId'])
  const directorNotes = readOptionalText(value['directorNotes'])
  const routing = readRouting(value['routing'])
  const consumedAfterTurn = readOptionalInteger(value['consumedAfterTurn'])
  const consumedAt = readOptionalText(value['consumedAt'])
  if (value['routing'] !== undefined && routing === undefined) return undefined

  return {
    ...(generatedByCorrelationId !== undefined ? { generatedByCorrelationId } : {}),
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

function readDialogueControl(value: unknown): DialogueControl | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, ['mode', 'askFollowUp'])) return undefined
  const mode = value['mode']
  return typeof mode === 'string' &&
    DIALOGUE_CONTROL_MODES.has(mode as DialogueControl['mode']) &&
    typeof value['askFollowUp'] === 'boolean'
    ? { mode: mode as DialogueControl['mode'], askFollowUp: value['askFollowUp'] }
    : undefined
}

// eslint-disable-next-line complexity
function readRetrievalPlan(value: unknown): RetrievalPlan | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, ['required', 'queries', 'requiredFacts', 'scopes'])) {
    return undefined
  }
  if (typeof value['required'] !== 'boolean') return undefined
  const queries = readOptionalTextArray(value['queries'])
  const requiredFacts = readOptionalTextArray(value['requiredFacts'])
  const scopes = readOptionalScopes(value['scopes'])
  if (
    (value['queries'] !== undefined && queries === undefined) ||
    (value['requiredFacts'] !== undefined && requiredFacts === undefined) ||
    (value['scopes'] !== undefined && scopes === undefined)
  ) {
    return undefined
  }
  return {
    required: value['required'],
    ...(queries !== undefined ? { queries } : {}),
    ...(requiredFacts !== undefined ? { requiredFacts } : {}),
    ...(scopes !== undefined ? { scopes } : {}),
  }
}

// eslint-disable-next-line complexity
function readProgressionUpdate(value: unknown): ProgressionUpdate | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, ['progression', 'objectiveId', 'reason'])) {
    return undefined
  }
  const progression = value['progression']
  if (
    typeof progression !== 'string' ||
    !PROGRESSION_STATES.has(progression as ProgressionUpdate['progression'])
  ) {
    return undefined
  }
  const objectiveId = readOptionalText(value['objectiveId'])
  const reason = readOptionalText(value['reason'])
  if (
    (value['objectiveId'] !== undefined && objectiveId === undefined) ||
    (value['reason'] !== undefined && reason === undefined)
  ) {
    return undefined
  }
  return {
    progression: progression as ProgressionUpdate['progression'],
    ...(objectiveId !== undefined ? { objectiveId } : {}),
    ...(reason !== undefined ? { reason } : {}),
  }
}

// eslint-disable-next-line complexity
function readRouting(value: unknown): RoutingDecision | undefined {
  if (value === undefined) return undefined
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['action', 'avatarId', 'reason', 'unlockDecisions'])
  ) {
    return undefined
  }
  const action = value['action']
  if (typeof action !== 'string' || !ROUTING_ACTIONS.has(action as RoutingDecision['action'])) {
    return undefined
  }
  const avatarId = readOptionalText(value['avatarId'])
  const reason = readOptionalText(value['reason'])
  const unlockDecisions = readOptionalUnlockDecisions(value['unlockDecisions'])
  if (
    (value['avatarId'] !== undefined && avatarId === undefined) ||
    (value['reason'] !== undefined && reason === undefined) ||
    (value['unlockDecisions'] !== undefined && unlockDecisions === undefined)
  ) {
    return undefined
  }
  return {
    action: action as RoutingDecision['action'],
    ...(avatarId !== undefined ? { avatarId } : {}),
    ...(reason !== undefined ? { reason } : {}),
    ...(unlockDecisions !== undefined ? { unlockDecisions } : {}),
  }
}

function readOptionalUnlockDecisions(
  value: unknown,
): RoutingDecision['unlockDecisions'] | undefined {
  if (!Array.isArray(value)) return undefined
  const decisions = value.map((entry) => {
    if (!isRecord(entry) || !hasOnlyKeys(entry, ['avatarId', 'reason'])) return undefined
    const avatarId = readRequiredText(entry['avatarId'])
    const reason = readRequiredText(entry['reason'])
    return avatarId !== undefined && reason !== undefined ? { avatarId, reason } : undefined
  })
  const validDecisions = decisions.filter(
    (decision): decision is NonNullable<RoutingDecision['unlockDecisions']>[number] =>
      decision !== undefined,
  )
  return validDecisions.length === decisions.length ? validDecisions : undefined
}

function readOptionalScopes(value: unknown): RetrievalScope[] | undefined {
  if (!Array.isArray(value)) return undefined
  const scopes = value.filter(
    (scope): scope is RetrievalScope =>
      typeof scope === 'string' && RETRIEVAL_SCOPES.has(scope as RetrievalScope),
  )
  return scopes.length === value.length ? [...new Set(scopes)] : undefined
}

function readOptionalTextArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const texts = value.map(readRequiredText)
  return texts.every((text): text is string => text !== undefined) ? texts : undefined
}

function readRequiredText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function readOptionalText(value: unknown): string | undefined {
  return value === undefined ? undefined : readRequiredText(value)
}

function readRequiredInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined
}

function readOptionalInteger(value: unknown): number | undefined {
  return value === undefined ? undefined : readRequiredInteger(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys)
  return Object.keys(value).every((key) => allowed.has(key))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

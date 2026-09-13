import type {
  DialogueControl,
  DialogueControlMode,
  GameMasterOutput,
  ProgressionUpdate,
  RetrievalPlan,
  RetrievalScope,
  RoutingAction,
  RoutingDecision,
} from './game-master.types.js'

const DIALOGUE_CONTROL_MODES = new Set<DialogueControlMode>([
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
const ROUTING_ACTIONS = new Set<RoutingAction>([
  'stay',
  'suggest',
  'switch',
  'unlock',
  'unlock_and_switch',
])
const PROGRESSION_STATES = new Set(['none', 'increase'])

export function safeParseGameMasterOutput(content: string): GameMasterOutput | null {
  try {
    const parsed: unknown = JSON.parse(content)
    const output = toGameMasterOutput(parsed)
    if (output !== null) {
      return output
    }
  } catch {
    console.error('[GM] Failed to parse Game Master output JSON.')
    return null
  }

  console.error(
    '[GM] Invalid Game Master output shape: missing required fields or incorrect types.',
  )
  return null
}

function toGameMasterOutput(value: unknown): GameMasterOutput | null {
  if (!isRecord(value)) return null
  if (
    !hasOnlyKeys(value, [
      'dialogueControl',
      'retrievalPlan',
      'directorNotes',
      'routing',
      'progressionUpdate',
    ])
  ) {
    return null
  }

  const dialogueControl = toDialogueControl(value['dialogueControl'])
  if (dialogueControl === null) return null

  const retrievalPlan = toRetrievalPlan(value['retrievalPlan'])
  if (retrievalPlan === null) return null

  const progressionUpdate = toProgressionUpdate(value['progressionUpdate'])
  if (progressionUpdate === null) return null

  const directorNotes = toRequiredDirectorNotes(value['directorNotes'])
  if (directorNotes === null) return null
  const routing = toRoutingDecision(value['routing'])

  return {
    dialogueControl,
    retrievalPlan,
    directorNotes,
    ...(routing !== undefined ? { routing } : {}),
    progressionUpdate,
  }
}

function toRequiredDirectorNotes(value: unknown): string | null {
  return hasText(value) ? value.trim() : null
}

function toDialogueControl(value: unknown): DialogueControl | null {
  if (!isRecord(value)) return null
  if (!hasOnlyKeys(value, ['mode', 'askFollowUp'])) return null
  const mode = value['mode']
  if (typeof mode !== 'string' || !DIALOGUE_CONTROL_MODES.has(mode as DialogueControlMode)) {
    return null
  }
  if (typeof value['askFollowUp'] !== 'boolean') return null

  return { mode: mode as DialogueControlMode, askFollowUp: value['askFollowUp'] }
}

function toRetrievalPlan(value: unknown): RetrievalPlan | null {
  if (!isRecord(value)) return null
  if (!hasOnlyKeys(value, ['required', 'queries', 'requiredFacts', 'scopes'])) return null
  if (typeof value['required'] !== 'boolean') return null

  const queries = toOptionalStringArray(value['queries'])
  const requiredFacts = toOptionalStringArray(value['requiredFacts'])
  const scopes = toOptionalScopes(value['scopes'])
  if (queries === null || requiredFacts === null || scopes === null) return null

  return {
    required: value['required'],
    ...(queries !== undefined ? { queries } : {}),
    ...(requiredFacts !== undefined ? { requiredFacts } : {}),
    ...(scopes !== undefined ? { scopes } : {}),
  }
}

function toOptionalScopes(value: unknown): RetrievalScope[] | undefined | null {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) return null
  if (
    !value.every((entry): entry is RetrievalScope => RETRIEVAL_SCOPES.has(entry as RetrievalScope))
  ) {
    return null
  }
  return [...new Set(value)]
}

// eslint-disable-next-line complexity
function toRoutingDecision(value: unknown): RoutingDecision | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) return { action: 'stay' }
  if (!hasOnlyKeys(value, ['action', 'avatarId', 'reason', 'unlockDecisions']))
    return { action: 'stay' }
  const action = value['action']
  if (typeof action !== 'string' || !ROUTING_ACTIONS.has(action as RoutingAction)) {
    return { action: 'stay' }
  }

  const avatarId = toOptionalText(value['avatarId'])
  const reason = toOptionalText(value['reason'])
  const unlockDecisions = toUnlockDecisions(value['unlockDecisions'])
  if (avatarId === null || reason === null || unlockDecisions === null) {
    return { action: 'stay' }
  }

  return {
    action: action as RoutingAction,
    ...(avatarId !== undefined ? { avatarId } : {}),
    ...(reason !== undefined ? { reason } : {}),
    ...(unlockDecisions !== undefined ? { unlockDecisions } : {}),
  }
}

function toUnlockDecisions(
  value: unknown,
): Array<{ avatarId: string; reason: string }> | undefined | null {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) return null
  const unlockDecisions: Array<{ avatarId: string; reason: string }> = []
  for (const entry of value) {
    if (
      !isRecord(entry) ||
      !hasOnlyKeys(entry, ['avatarId', 'reason']) ||
      !hasText(entry['avatarId']) ||
      !hasText(entry['reason'])
    ) {
      return null
    }
    unlockDecisions.push({ avatarId: entry['avatarId'].trim(), reason: entry['reason'].trim() })
  }
  return unlockDecisions
}

function toProgressionUpdate(value: unknown): ProgressionUpdate | null {
  if (!isRecord(value)) return null
  if (!hasOnlyKeys(value, ['progression', 'objectiveId', 'reason'])) return null
  const progression = value['progression']
  if (typeof progression !== 'string' || !PROGRESSION_STATES.has(progression)) return null

  const objectiveId = toOptionalText(value['objectiveId'])
  const reason = toOptionalText(value['reason'])
  if (objectiveId === null || reason === null) return null

  return {
    progression: progression as ProgressionUpdate['progression'],
    ...(objectiveId !== undefined ? { objectiveId } : {}),
    ...(reason !== undefined ? { reason } : {}),
  }
}

function toOptionalStringArray(value: unknown): string[] | undefined | null {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || !value.every(hasText)) return null
  return value.map((item) => item.trim())
}

function toOptionalText(value: unknown): string | undefined | null {
  if (value === undefined) return undefined
  return hasText(value) ? value.trim() : null
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys)
  return Object.keys(value).every((key) => allowed.has(key))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

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
  } catch (parseError) {
    console.error('[GM] Failed to parse Game Master output JSON:', content, parseError)
    return null
  }

  console.error(
    '[GM] Invalid Game Master output shape: missing required fields or incorrect types.',
  )
  return null
}

function toGameMasterOutput(value: unknown): GameMasterOutput | null {
  if (!isRecord(value)) return null

  const dialogueControl = toDialogueControl(value['dialogueControl'])
  if (dialogueControl === null) return null

  const retrievalPlan =
    value['retrievalPlan'] === undefined
      ? { required: false }
      : toRetrievalPlan(value['retrievalPlan'])
  if (retrievalPlan === null) return null

  const progressionUpdate =
    value['progressionUpdate'] === undefined
      ? { progression: 'none' as const }
      : toProgressionUpdate(value['progressionUpdate'])
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
  const mode = value['mode']
  if (typeof mode !== 'string' || !DIALOGUE_CONTROL_MODES.has(mode as DialogueControlMode)) {
    return null
  }
  if (typeof value['askFollowUp'] !== 'boolean') return null

  return { mode: mode as DialogueControlMode, askFollowUp: value['askFollowUp'] }
}

function toRetrievalPlan(value: unknown): RetrievalPlan | null {
  if (!isRecord(value)) return null
  if (typeof value['required'] !== 'boolean') return null

  const queries = toOptionalStringArray(value['queries'])
  const requiredFacts = toOptionalStringArray(value['requiredFacts'])
  const scopes = toOptionalScopes(value['scopes'])

  return {
    required: value['required'],
    ...(queries !== undefined ? { queries } : {}),
    ...(requiredFacts !== undefined ? { requiredFacts } : {}),
    ...(scopes !== undefined ? { scopes } : {}),
  }
}

function toOptionalScopes(value: unknown): RetrievalScope[] | undefined {
  if (!Array.isArray(value)) return undefined
  const scopes = value.filter((entry): entry is RetrievalScope =>
    RETRIEVAL_SCOPES.has(entry as RetrievalScope),
  )
  return scopes.length > 0 ? [...new Set(scopes)] : undefined
}

function toRoutingDecision(value: unknown): RoutingDecision | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) return { action: 'stay' }
  const action = value['action']
  if (typeof action !== 'string' || !ROUTING_ACTIONS.has(action as RoutingAction)) {
    return { action: 'stay' }
  }

  const avatarId = hasText(value['avatarId']) ? value['avatarId'].trim() : undefined
  const reason = hasText(value['reason']) ? value['reason'].trim() : undefined
  const unlockDecisions = toUnlockDecisions(value['unlockDecisions'])

  return {
    action: action as RoutingAction,
    ...(avatarId !== undefined ? { avatarId } : {}),
    ...(reason !== undefined ? { reason } : {}),
    ...(unlockDecisions !== undefined ? { unlockDecisions } : {}),
  }
}

function toUnlockDecisions(
  value: unknown,
): Array<{ avatarId: string; reason: string }> | undefined {
  if (!Array.isArray(value)) return undefined
  const unlockDecisions = value
    .map((entry) => {
      if (!isRecord(entry) || !hasText(entry['avatarId']) || !hasText(entry['reason'])) return null
      return { avatarId: entry['avatarId'].trim(), reason: entry['reason'].trim() }
    })
    .filter((entry): entry is { avatarId: string; reason: string } => entry !== null)

  return unlockDecisions.length > 0 ? unlockDecisions : undefined
}

function toProgressionUpdate(value: unknown): ProgressionUpdate | null {
  if (!isRecord(value)) return null
  const progression = value['progression']
  if (typeof progression !== 'string' || !PROGRESSION_STATES.has(progression)) return null

  const objectiveId = hasText(value['objectiveId']) ? value['objectiveId'].trim() : undefined
  const reason = hasText(value['reason']) ? value['reason'].trim() : undefined

  return {
    progression: progression as ProgressionUpdate['progression'],
    ...(objectiveId !== undefined ? { objectiveId } : {}),
    ...(reason !== undefined ? { reason } : {}),
  }
}

function toOptionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items = value.filter(hasText).map((item) => item.trim())
  return items.length > 0 ? items : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

import type { GameMasterOutput } from '../../../domain/game-master/game-master.types.js'

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
  if (!isRecord(value)) {
    return null
  }
  const baseOutput = parseBaseOutput(value)
  if (baseOutput === null) return null

  const stateUpdate = toStateUpdate(value['stateUpdate'])
  if (stateUpdate === null) return null

  return {
    avatarId: baseOutput.avatarId,
    conversationMode: baseOutput.conversationMode,
    ...parseOptionalOutputFields(value),
    stateUpdate,
  }
}

function parseBaseOutput(value: Record<string, unknown>): {
  avatarId: string
  conversationMode: 'new' | 'continue'
} | null {
  if (!hasText(value['avatarId']) || !isConversationMode(value['conversationMode'])) {
    return null
  }
  return {
    avatarId: value['avatarId'].trim(),
    conversationMode: value['conversationMode'],
  }
}

function parseOptionalOutputFields(value: Record<string, unknown>): {
  nextAvatarId?: string
  transitionReason?: string
  context?: { notes: string }
  unlockAvatarIds?: string[]
  suggestedAvatarId?: string
  suggestedAvatarReason?: string
} {
  return {
    ...parseOptionalTextField(value, 'nextAvatarId'),
    ...parseOptionalTextField(value, 'transitionReason'),
    ...parseOptionalContext(value),
    ...parseOptionalUnlockAvatarIds(value),
    ...parseOptionalTextField(value, 'suggestedAvatarId'),
    ...parseOptionalTextField(value, 'suggestedAvatarReason'),
  }
}

function parseOptionalTextField<
  K extends 'nextAvatarId' | 'transitionReason' | 'suggestedAvatarId' | 'suggestedAvatarReason',
>(value: Record<string, unknown>, key: K): Partial<Record<K, string>> {
  return hasText(value[key]) ? ({ [key]: value[key].trim() } as Partial<Record<K, string>>) : {}
}

function parseOptionalContext(value: Record<string, unknown>): { context?: { notes: string } } {
  const context = value['context']
  const notes = isRecord(context) && hasText(context['notes']) ? context['notes'].trim() : undefined
  return notes !== undefined ? { context: { notes } } : {}
}

function parseOptionalUnlockAvatarIds(value: Record<string, unknown>): {
  unlockAvatarIds?: string[]
} {
  if (!Array.isArray(value['unlockAvatarIds'])) return {}
  return {
    unlockAvatarIds: value['unlockAvatarIds'].filter(hasText).map((avatarId) => avatarId.trim()),
  }
}

function toStateUpdate(value: unknown): GameMasterOutput['stateUpdate'] | null {
  if (!isRecord(value)) {
    return null
  }
  if (value['interactionIncrement'] !== 1) {
    return null
  }
  if (!isValidProgression(value['progression'])) {
    return null
  }
  const topicCovered = hasText(value['topicCovered']) ? value['topicCovered'].trim() : undefined
  const activeAvatarId = hasText(value['activeAvatarId'])
    ? value['activeAvatarId'].trim()
    : undefined

  return {
    interactionIncrement: 1,
    ...(value['progression'] !== undefined ? { progression: value['progression'] } : {}),
    ...(topicCovered !== undefined ? { topicCovered } : {}),
    ...(activeAvatarId !== undefined ? { activeAvatarId } : {}),
  }
}

function isValidProgression(value: unknown): value is 'none' | 'increase' | undefined {
  return value === undefined || value === 'none' || value === 'increase'
}

function isConversationMode(value: unknown): value is 'new' | 'continue' {
  return value === 'new' || value === 'continue'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

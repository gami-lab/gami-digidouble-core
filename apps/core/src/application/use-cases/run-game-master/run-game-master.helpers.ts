import type { AvatarTransitionRule } from '../../../domain/avatar/avatar-transition.types.js'
import type { GameMasterOutput } from '../../../domain/game-master/game-master.types.js'
import type { TriggerPolicy, TriggerReason } from '../../../domain/game-master/trigger-engine.js'

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

export function mapTriggerReasonToTransitionTrigger(
  triggerReason: TriggerReason,
): 'progression' | 'topic_repeat' {
  return triggerReason === 'topic_repeat' ? 'topic_repeat' : 'progression'
}

export function extractScenarioPolicy(config: unknown): { policy?: TriggerPolicy } {
  if (!isRecord(config)) {
    return {}
  }
  const policyRaw = config['policy']
  if (typeof policyRaw !== 'object' || policyRaw === null) {
    return {}
  }

  const policyCandidate = policyRaw as Record<string, unknown>
  const turnThreshold = toValidPositiveInteger(policyCandidate['turnThreshold'])
  const maxTopicRepeatCount = toValidPositiveInteger(policyCandidate['maxTopicRepeatCount'])
  const maxTurnsWithoutProgression = toValidPositiveInteger(
    policyCandidate['maxTurnsWithoutProgression'],
  )
  const policy: TriggerPolicy = {
    ...(turnThreshold !== undefined ? { turnThreshold } : {}),
    ...(maxTopicRepeatCount !== undefined ? { maxTopicRepeatCount } : {}),
    ...(maxTurnsWithoutProgression !== undefined ? { maxTurnsWithoutProgression } : {}),
  }

  return Object.keys(policy).length > 0 ? { policy } : {}
}

export function extractScenarioAvatarTransitionRules(config: unknown): {
  avatarTransitionRules?: AvatarTransitionRule[]
} {
  if (!isRecord(config) || !Array.isArray(config['avatarTransitionRules'])) {
    return {}
  }
  return { avatarTransitionRules: config['avatarTransitionRules'] as AvatarTransitionRule[] }
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
} {
  const context = value['context']
  const notes = isRecord(context) && hasText(context['notes']) ? context['notes'].trim() : undefined
  const nextAvatarId = hasText(value['nextAvatarId']) ? value['nextAvatarId'].trim() : undefined
  const transitionReason = hasText(value['transitionReason'])
    ? value['transitionReason'].trim()
    : undefined

  return {
    ...(nextAvatarId !== undefined ? { nextAvatarId } : {}),
    ...(transitionReason !== undefined ? { transitionReason } : {}),
    ...(notes !== undefined ? { context: { notes } } : {}),
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

function toValidPositiveInteger(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return undefined
  }
  return value
}

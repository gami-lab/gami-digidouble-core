import type { IEventLogRepository, StoredEvent } from '../../ports/IEventLogRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { GmUnlockEvaluation } from '@gami/shared'
import { DomainError } from '../../../domain/errors.js'
import type {
  GmSessionEventPayload,
  ListSessionEventsInput,
  ListSessionEventsOutput,
  MemoryConsolidationEventPayload,
  MemoryRefreshEventPayload,
  MessageAudioEventPayload,
  SessionEventRecord,
  TurnCompletedEventPayload,
} from './list-session-events.types.js'
import {
  readStringArray,
  readStringOrNull,
  readOptionalString,
  readOptionalStringArray,
  readOptionalCandidateFacts,
  readOptionalStringField,
  readString,
  readOptionalStringArrayField,
  readOptionalNumberField,
  readNumber,
  readOptionalNumber,
  readBoolean,
  isRecord,
} from './session-event-field-readers.js'
import {
  readOptionalAvatarContextSnapshot,
  readOptionalGmContextSnapshot,
  readOptionalContextSelection,
  readStateSummary,
  readOptionalStateSummary,
} from './recorded-context-snapshot-readers.js'

const DEFAULT_LIMIT = 50

const MAX_LIMIT = 200

export class ListSessionEventsUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly eventLogRepository: IEventLogRepository,
  ) {}

  async execute(input: ListSessionEventsInput): Promise<ListSessionEventsOutput> {
    const session = await this.sessionRepository.findById(input.sessionId)
    if (session === null) {
      throw new DomainError('NOT_FOUND', `Session ${input.sessionId} was not found.`)
    }

    const events = await this.eventLogRepository.findBySessionId(input.sessionId, {
      limit: resolveLimit(input.limit),
    })

    return {
      events: events.flatMap(toSafeSessionEvent),
    }
  }
}

function resolveLimit(limit: number | undefined): number {
  return Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT)
}

const MEMORY_REFRESH_TYPES = new Set([
  'memory_refresh_triggered',
  'memory_refresh_succeeded',
  'memory_refresh_failed',
])

const MEMORY_CONSOLIDATION_TYPES = new Set([
  'episodic_memory_generation_succeeded',
  'episodic_memory_generation_failed',
])

const MESSAGE_AUDIO_TYPES = new Set(['message_audio_synthesized', 'message_audio_failed'])

const ALLOWED_EVENT_TYPES = new Set([
  ...MESSAGE_AUDIO_TYPES,
  'gm_triggered',
  'gm_error',
  'turn_completed',
  ...MEMORY_REFRESH_TYPES,
  ...MEMORY_CONSOLIDATION_TYPES,
])

function toSafeSessionEvent(event: StoredEvent): SessionEventRecord[] {
  if (!ALLOWED_EVENT_TYPES.has(event.type)) return []
  // Work outside a turn (conversation close, avatar switch) has only a request id.
  const correlationId = event.correlationId ?? event.requestId
  if (correlationId === undefined || event.createdAt === undefined) return []

  const payload = resolvePayload(event)
  if (payload === null) return []

  return [
    {
      type: event.type as SessionEventRecord['type'],
      correlationId,
      createdAt: event.createdAt,
      payload,
    },
  ]
}

function resolvePayload(event: StoredEvent): SessionEventRecord['payload'] | null {
  if (MEMORY_REFRESH_TYPES.has(event.type)) return toSafeMemoryRefreshPayload(event.payload)
  if (MESSAGE_AUDIO_TYPES.has(event.type)) return toSafeMessageAudioPayload(event.payload)
  if (MEMORY_CONSOLIDATION_TYPES.has(event.type)) {
    return toSafeMemoryConsolidationPayload(event.payload)
  }
  if (event.type === 'turn_completed') return toSafeTurnCompletedPayload(event.payload)
  return toSafePayload(event.payload)
}

function toSafePayload(payload: Record<string, unknown>): GmSessionEventPayload {
  const safePayload: GmSessionEventPayload = {
    triggerReason: readStringOrNull(payload['triggerReason']),
    turnIndex: readNumber(payload['turnIndex']),
    interactionCount: readNumber(payload['interactionCount']),
    stateBefore: readStateSummary(payload['stateBefore']),
    latencyMs: readNumber(payload['latencyMs']),
  }
  const decision = readDecision(payload['decision'])
  const stateAfter = readOptionalStateSummary(payload['stateAfter'])
  const gmContext = readOptionalGmContextSnapshot(payload['gmContext'])
  const totalLatencyMs = readOptionalNumber(payload['totalLatencyMs'])
  const provider = readOptionalString(payload['provider'])
  const model = readOptionalString(payload['model'])
  const inputTokens = readOptionalNumber(payload['inputTokens'])
  const outputTokens = readOptionalNumber(payload['outputTokens'])

  return {
    ...safePayload,
    ...(gmContext !== undefined ? { gmContext } : {}),
    ...(decision !== undefined ? { decision } : {}),
    ...(stateAfter !== undefined ? { stateAfter } : {}),
    ...(totalLatencyMs !== undefined ? { totalLatencyMs } : {}),
    ...(provider !== undefined ? { provider } : {}),
    ...(model !== undefined ? { model } : {}),
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
    ...readOptionalStringField(payload, 'errorCode'),
    ...readOptionalStringField(payload, 'llmTraceId'),
  }
}

// eslint-disable-next-line complexity -- allow-lists each optional recorded memory field from an untrusted event payload
function toSafeMemoryRefreshPayload(payload: Record<string, unknown>): MemoryRefreshEventPayload {
  const base: MemoryRefreshEventPayload = {
    sessionId: readString(payload['sessionId']),
    conversationId: readString(payload['conversationId']),
    avatarId: readString(payload['avatarId']),
    trigger: readMemoryTrigger(payload['trigger']),
  }
  const workingSummary = readOptionalString(payload['workingSummary'])
  const messageCount = readOptionalNumber(payload['messageCount'])
  const unresolvedThreads = readOptionalStringArray(payload['unresolvedThreads'])
  const coveredTopics = readOptionalStringArray(payload['coveredTopics'])
  const candidateFacts = readOptionalCandidateFacts(payload['candidateFacts'])
  const exchangeCount = readOptionalNumber(payload['exchangeCount'])
  const provider = readOptionalString(payload['provider'])
  const model = readOptionalString(payload['model'])
  const inputTokens = readOptionalNumber(payload['inputTokens'])
  const outputTokens = readOptionalNumber(payload['outputTokens'])
  const error = readOptionalString(payload['error'])
  const latencyMs = readOptionalNumber(payload['latencyMs'])
  const llmTraceId = readOptionalString(payload['llmTraceId'])
  return {
    ...base,
    ...(workingSummary !== undefined ? { workingSummary } : {}),
    ...(messageCount !== undefined ? { messageCount } : {}),
    ...(unresolvedThreads !== undefined ? { unresolvedThreads } : {}),
    ...(coveredTopics !== undefined ? { coveredTopics } : {}),
    ...(candidateFacts !== undefined ? { candidateFacts } : {}),
    ...(exchangeCount !== undefined ? { exchangeCount } : {}),
    ...(provider !== undefined ? { provider } : {}),
    ...(model !== undefined ? { model } : {}),
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
    ...(error !== undefined ? { error } : {}),
    ...(latencyMs !== undefined ? { latencyMs } : {}),
    ...(llmTraceId !== undefined ? { llmTraceId } : {}),
  }
}

function toSafeMemoryConsolidationPayload(
  payload: Record<string, unknown>,
): MemoryConsolidationEventPayload {
  return {
    conversationId: readString(payload['conversationId']),
    ...readOptionalStringField(payload, 'avatarId'),
    ...readOptionalStringField(payload, 'error'),
  }
}

function toSafeMessageAudioPayload(payload: Record<string, unknown>): MessageAudioEventPayload {
  const byteLength = readOptionalNumber(payload['byteLength'])
  const firstAudioMs = readOptionalNumber(payload['firstAudioMs'])
  return {
    conversationId: readString(payload['conversationId']),
    messageId: readString(payload['messageId']),
    provider: readString(payload['provider']),
    characterCount: readNumber(payload['characterCount']),
    latencyMs: readNumber(payload['latencyMs']),
    ...(firstAudioMs !== undefined ? { firstAudioMs } : {}),
    ...(byteLength !== undefined ? { byteLength } : {}),
    ...readOptionalStringField(payload, 'errorCode'),
  }
}

function readMemoryTrigger(value: unknown): MemoryRefreshEventPayload['trigger'] {
  if (
    value === 'post_turn' ||
    value === 'conversation_closed' ||
    value === 'avatar_switch' ||
    value === 'admin_trigger'
  )
    return value
  return 'post_turn'
}

function toSafeTurnCompletedPayload(payload: Record<string, unknown>): TurnCompletedEventPayload {
  const avatarContext = readOptionalAvatarContextSnapshot(payload['avatarContext'])
  const contextSelection = readOptionalContextSelection(payload['contextSelection'])
  const consumedGmRetrievalPlan = readConsumedGmRetrievalPlan(payload['consumedGmRetrievalPlan'])
  return {
    conversationId: readString(payload['conversationId']),
    turnIndex: readNumber(payload['turnIndex']),
    avatarId: readString(payload['avatarId']),
    ...(consumedGmRetrievalPlan !== undefined ? { consumedGmRetrievalPlan } : {}),
    ...(avatarContext !== undefined ? { avatarContext } : {}),
    avatarLatencyMs: readNumber(payload['avatarLatencyMs']),
    totalTurnLatencyMs: readNumber(payload['totalTurnLatencyMs']),
    inputTokens: readNumber(payload['inputTokens']),
    outputTokens: readNumber(payload['outputTokens']),
    totalTokens: readNumber(payload['totalTokens']),
    model: readString(payload['model']),
    hasGm: readBoolean(payload['hasGm']),
    ...readOptionalNumberField(payload, 'retrievalLatencyMs'),
    ...readOptionalNumberField(payload, 'otherOverheadMs'),
    ...readOptionalNumberField(payload, 'avatarFirstTokenLatencyMs'),
    ...readOptionalNumberField(payload, 'speechToTextLatencyMs'),
    inputMode: payload['inputMode'] === 'voice' ? 'voice' : 'text',
    ...(contextSelection !== undefined ? { contextSelection } : {}),
    ...readOptionalStringField(payload, 'correlationId'),
  }
}

type GmDecision = NonNullable<GmSessionEventPayload['decision']>

const DIALOGUE_MODES = new Set<GmDecision['dialogueMode']>([
  'user_led',
  'avatar_guided',
  'avatar_led',
  'repair',
  'transition',
])

const ROUTING_ACTIONS = new Set<NonNullable<GmDecision['routingAction']>>([
  'stay',
  'suggest',
  'switch',
  'unlock',
  'unlock_and_switch',
])

function readDialogueMode(value: unknown): GmDecision['dialogueMode'] {
  return DIALOGUE_MODES.has(value as GmDecision['dialogueMode'])
    ? (value as GmDecision['dialogueMode'])
    : 'user_led'
}

function readOptionalRoutingAction(value: unknown): Pick<GmDecision, 'routingAction'> | object {
  return ROUTING_ACTIONS.has(value as NonNullable<GmDecision['routingAction']>)
    ? { routingAction: value as NonNullable<GmDecision['routingAction']> }
    : {}
}

function readDecision(value: unknown): GmSessionEventPayload['decision'] | undefined {
  if (!isRecord(value)) return undefined
  const progression = value['progression']
  const unlockEvaluations = readOptionalUnlockEvaluations(value['unlockEvaluations'])
  const retrievalPlan = readRetrievalPlan(value['retrievalPlan'])
  return {
    dialogueMode: readDialogueMode(value['dialogueMode']),
    askFollowUp: value['askFollowUp'] === true,
    notesInjected: value['notesInjected'] === true,
    ...readOptionalStringField(value, 'injectedNote'),
    retrievalRequired: value['retrievalRequired'] === true,
    ...(retrievalPlan !== undefined ? { retrievalPlan } : {}),
    ...readOptionalRoutingAction(value['routingAction']),
    ...readOptionalStringField(value, 'routingAvatarId'),
    ...readOptionalStringField(value, 'routingReason'),
    ...(unlockEvaluations !== undefined ? { unlockEvaluations } : {}),
    ...readOptionalStringField(value, 'switchedAvatarId'),
    ...readOptionalStringField(value, 'mediaCueAssetId'),
    ...readMediaCueOutcome(value['mediaCueOutcome']),
    ...readOptionalStringArrayField(value, 'unlockedAvatarIds'),
    progression: progression === 'increase' ? 'increase' : 'none',
    ...readOptionalStringField(value, 'objectiveId'),
  }
}

function readMediaCueOutcome(
  value: unknown,
): Pick<NonNullable<GmSessionEventPayload['decision']>, 'mediaCueOutcome'> {
  return value === 'accepted' || value === 'rejected_not_in_catalogue'
    ? { mediaCueOutcome: value }
    : {}
}

function readRetrievalPlan(
  value: unknown,
): NonNullable<GmSessionEventPayload['decision']>['retrievalPlan'] | undefined {
  if (!isRecord(value)) return undefined
  return {
    required: value['required'] === true,
    queries: readStringArray(value['queries']),
    requiredFacts: readStringArray(value['requiredFacts']),
  }
}

function readConsumedGmRetrievalPlan(
  value: unknown,
): TurnCompletedEventPayload['consumedGmRetrievalPlan'] | undefined {
  if (!isRecord(value)) return undefined
  const generatedAt = readOptionalString(value['generatedAt'])
  if (generatedAt === undefined) return undefined
  return {
    ...(typeof value['generatedByCorrelationId'] === 'string'
      ? { generatedByCorrelationId: value['generatedByCorrelationId'] }
      : {}),
    generatedAfterTurn: readNumber(value['generatedAfterTurn']),
    generatedAt,
    consumedOnTurn: readNumber(value['consumedOnTurn']),
    required: value['required'] === true,
    queries: readStringArray(value['queries']),
    requiredFacts: readStringArray(value['requiredFacts']),
  }
}

function readOptionalUnlockEvaluations(value: unknown): GmUnlockEvaluation[] | undefined {
  if (!Array.isArray(value)) return undefined

  const unlockEvaluations = value
    .map((entry) => {
      if (!isRecord(entry)) return null
      const avatarId = readOptionalString(entry['avatarId'])
      const avatarName = readOptionalString(entry['avatarName'])
      if (avatarId === undefined || avatarName === undefined) return null
      const outcome = entry['outcome']
      if (
        outcome !== 'unlocked' &&
        outcome !== 'already_unlocked' &&
        outcome !== 'rejected_not_mentioned'
      ) {
        return null
      }
      return {
        avatarId,
        avatarName,
        ...(typeof entry['reason'] === 'string' ? { reason: entry['reason'] } : {}),
        outcome,
      }
    })
    .filter((entry): entry is GmUnlockEvaluation => entry !== null)

  return unlockEvaluations.length > 0 ? unlockEvaluations : undefined
}

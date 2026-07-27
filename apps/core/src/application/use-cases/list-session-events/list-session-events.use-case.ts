/* eslint-disable max-lines */
import type { IEventLogRepository, StoredEvent } from '../../ports/IEventLogRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { GmUnlockEvaluation } from '@gami/shared'
import type {
  RecordedAvatarContextSnapshot,
  RecordedGmContextSnapshot,
  RecordedKnowledgeReference,
  UserPersona,
} from '@gami/shared'
import type { GameMasterStateSummary } from '../../../domain/game-master/game-master.types.js'
import { DomainError } from '../../../domain/errors.js'
import type {
  GmSessionEventPayload,
  ListSessionEventsInput,
  ListSessionEventsOutput,
  MemoryRefreshEventPayload,
  SessionEventRecord,
  TurnCompletedEventPayload,
} from './list-session-events.types.js'

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

const ALLOWED_EVENT_TYPES = new Set([
  'gm_triggered',
  'gm_error',
  'turn_completed',
  ...MEMORY_REFRESH_TYPES,
])

function toSafeSessionEvent(event: StoredEvent): SessionEventRecord[] {
  if (!ALLOWED_EVENT_TYPES.has(event.type)) return []
  if (event.correlationId === undefined || event.createdAt === undefined) return []

  const payload = resolvePayload(event)
  if (payload === null) return []

  return [
    {
      type: event.type as SessionEventRecord['type'],
      correlationId: event.correlationId,
      createdAt: event.createdAt,
      payload,
    },
  ]
}

function resolvePayload(
  event: StoredEvent,
): GmSessionEventPayload | TurnCompletedEventPayload | MemoryRefreshEventPayload | null {
  if (MEMORY_REFRESH_TYPES.has(event.type)) return toSafeMemoryRefreshPayload(event.payload)
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
  const inputTokens = readOptionalNumber(payload['inputTokens'])
  const outputTokens = readOptionalNumber(payload['outputTokens'])
  const errorCode = readOptionalString(payload['errorCode'])

  return {
    ...safePayload,
    ...(gmContext !== undefined ? { gmContext } : {}),
    ...(decision !== undefined ? { decision } : {}),
    ...(stateAfter !== undefined ? { stateAfter } : {}),
    ...(totalLatencyMs !== undefined ? { totalLatencyMs } : {}),
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
    ...(errorCode !== undefined ? { errorCode } : {}),
  }
}

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
  const error = readOptionalString(payload['error'])
  return {
    ...base,
    ...(workingSummary !== undefined ? { workingSummary } : {}),
    ...(messageCount !== undefined ? { messageCount } : {}),
    ...(unresolvedThreads !== undefined ? { unresolvedThreads } : {}),
    ...(coveredTopics !== undefined ? { coveredTopics } : {}),
    ...(candidateFacts !== undefined ? { candidateFacts } : {}),
    ...(exchangeCount !== undefined ? { exchangeCount } : {}),
    ...(error !== undefined ? { error } : {}),
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
  const contextSelection = readOptionalContextSelection(payload['contextSelection'], avatarContext)
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
    ...(contextSelection !== undefined ? { contextSelection } : {}),
    ...readOptionalStringField(payload, 'correlationId'),
  }
}

function readOptionalAvatarContextSnapshot(
  value: unknown,
): RecordedAvatarContextSnapshot | undefined {
  if (!isRecord(value)) return undefined

  if (isRecord(value['sections'])) {
    return {
      ...(typeof value['avatarId'] === 'string' ? { avatarId: value['avatarId'] } : {}),
      sections: readAvatarSections(value['sections']),
    }
  }

  return {
    ...(typeof value['avatarId'] === 'string' ? { avatarId: value['avatarId'] } : {}),
    sections: readLegacyAvatarSections(value),
  }
}

function readOptionalGmContextSnapshot(value: unknown): RecordedGmContextSnapshot | undefined {
  if (!isRecord(value)) return undefined

  return {
    currentState: readFullStateSummary(value['currentState']),
    availableAvatars: readAvailableAvatars(value['availableAvatars']),
    sections: isRecord(value['sections'])
      ? readGmSections(value['sections'])
      : readLegacyGmSections(value),
  }
}

// eslint-disable-next-line complexity
function readOptionalContextSelection(
  value: unknown,
  avatarContext: RecordedAvatarContextSnapshot | undefined,
): TurnCompletedEventPayload['contextSelection'] | undefined {
  if (!isRecord(value)) return undefined
  const retrieval = readOptionalRetrievalSelection(value['retrieval'], avatarContext)
  const retrievalCountsValue = isRecord(value['retrievalCounts'])
    ? value['retrievalCounts']
    : undefined
  const visibility = readOptionalVisibilitySelection(value['visibility'])
  const selection = {
    shortTermExchangeCount: readNumber(value['shortTermExchangeCount']),
    hasWorkingMemory: readBoolean(value['hasWorkingMemory']),
    longTermFactCount: readNumber(value['longTermFactCount']),
    ...(retrieval !== undefined
      ? { retrieval }
      : retrievalCountsValue !== undefined
        ? {
            retrieval: {
              selectedForAssemblyCounts: readRetrievalCounts(retrievalCountsValue),
              includedCounts: readIncludedRetrievalCounts(avatarContext),
              omittedByAssemblyCounts: {
                memory: Math.max(
                  0,
                  readNumber(retrievalCountsValue['memory']) -
                    (avatarContext?.sections.retrievedContext?.memory.length ?? 0),
                ),
                world: Math.max(
                  0,
                  readNumber(retrievalCountsValue['world']) -
                    (avatarContext?.sections.retrievedContext?.world.length ?? 0),
                ),
                media: Math.max(
                  0,
                  readNumber(retrievalCountsValue['media']) -
                    (avatarContext?.sections.retrievedContext?.media.length ?? 0),
                ),
              },
              ...(visibility !== undefined
                ? { excludedByVisibilityCounts: visibility.excludedCounts }
                : {}),
            },
          }
        : {}),
    hasUserPersona: readBoolean(value['hasUserPersona']),
    hasGmDirective: readBoolean(value['hasGmDirective']),
    responseRuleCount: readNumber(value['responseRuleCount']),
    hasAvatarTraits: readBoolean(value['hasAvatarTraits']),
  }

  return selection as NonNullable<TurnCompletedEventPayload['contextSelection']>
}

// eslint-disable-next-line complexity
function readOptionalRetrievalSelection(
  value: unknown,
  avatarContext: RecordedAvatarContextSnapshot | undefined,
): NonNullable<TurnCompletedEventPayload['contextSelection']>['retrieval'] | undefined {
  if (!isRecord(value)) return undefined
  const selectedCountsValue = isRecord(value['selectedForAssemblyCounts'])
    ? value['selectedForAssemblyCounts']
    : isRecord(value['selectedCounts'])
      ? value['selectedCounts']
      : undefined
  const includedCountsValue = isRecord(value['includedCounts'])
    ? value['includedCounts']
    : undefined
  const omittedCountsValue = isRecord(value['omittedByAssemblyCounts'])
    ? value['omittedByAssemblyCounts']
    : undefined
  const excludedCountsValue = isRecord(value['excludedByVisibilityCounts'])
    ? value['excludedByVisibilityCounts']
    : undefined
  if (selectedCountsValue === undefined && includedCountsValue === undefined) return undefined
  const selectedForAssemblyCounts =
    selectedCountsValue !== undefined
      ? readRetrievalCounts(selectedCountsValue)
      : { memory: 0, world: 0, media: 0 }
  const includedCounts =
    includedCountsValue !== undefined
      ? readRetrievalCounts(includedCountsValue)
      : readIncludedRetrievalCounts(avatarContext)
  return {
    selectedForAssemblyCounts,
    includedCounts,
    omittedByAssemblyCounts:
      omittedCountsValue !== undefined
        ? readRetrievalCounts(omittedCountsValue)
        : {
            memory: Math.max(0, selectedForAssemblyCounts.memory - includedCounts.memory),
            world: Math.max(0, selectedForAssemblyCounts.world - includedCounts.world),
            media: Math.max(0, selectedForAssemblyCounts.media - includedCounts.media),
          },
    ...(excludedCountsValue !== undefined
      ? { excludedByVisibilityCounts: readRetrievalCounts(excludedCountsValue) }
      : {}),
  }
}

function readOptionalVisibilitySelection(
  value: unknown,
): { excludedCounts: { memory: number; world: number; media: number } } | undefined {
  if (!isRecord(value)) return undefined
  const excludedCountsValue = isRecord(value['excludedCounts']) ? value['excludedCounts'] : {}
  return {
    excludedCounts: {
      memory: readNumber(excludedCountsValue['memory']),
      world: readNumber(excludedCountsValue['world']),
      media: readNumber(excludedCountsValue['media']),
    },
  }
}

function readRetrievalCounts(value: Record<string, unknown>): {
  memory: number
  world: number
  media: number
} {
  return {
    memory: readNumber(value['memory']),
    world: readNumber(value['world']),
    media: readNumber(value['media']),
  }
}

function readIncludedRetrievalCounts(avatarContext: RecordedAvatarContextSnapshot | undefined): {
  memory: number
  world: number
  media: number
} {
  return {
    memory: avatarContext?.sections.retrievedContext?.memory.length ?? 0,
    world: avatarContext?.sections.retrievedContext?.world.length ?? 0,
    media: avatarContext?.sections.retrievedContext?.media.length ?? 0,
  }
}

function readStateSummary(value: unknown): GameMasterStateSummary {
  const record = isRecord(value) ? value : {}
  return {
    progression: typeof record['progression'] === 'string' ? record['progression'] : '',
  }
}

function readFullStateSummary(value: unknown): RecordedGmContextSnapshot['currentState'] {
  const record = isRecord(value) ? value : {}
  return {
    ...readStateSummary(record),
    interactionCount: readNumber(record['interactionCount']),
  }
}

function readOptionalStateSummary(value: unknown): GameMasterStateSummary | undefined {
  return isRecord(value) ? readStateSummary(value) : undefined
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
    ...readOptionalStringArrayField(value, 'unlockedAvatarIds'),
    progression: progression === 'increase' ? 'increase' : 'none',
    ...readOptionalStringField(value, 'objectiveId'),
  }
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

function readAvatarSections(
  value: Record<string, unknown>,
): RecordedAvatarContextSnapshot['sections'] {
  const retrievedContext = isRecord(value['retrievedContext'])
    ? readAvatarKnowledge(value['retrievedContext'])
    : undefined
  const avatarTraits = isRecord(value['avatarTraits'])
    ? readRecordedAvatarTraits(value['avatarTraits'])
    : undefined
  return {
    directorNotes: readStringOrNull(value['directorNotes']),
    responseRules: readRecordedResponseRules(value['responseRules']),
    conversationState: {
      recentExchanges: readRecentExchanges(value['conversationState']),
      workingMemory: readAvatarWorkingMemory(value['conversationState']),
      longTermFacts: readLongTermFacts(value['conversationState']),
    },
    ...(retrievedContext !== undefined ? { retrievedContext } : {}),
    userPersona: readUserPersona(value['userPersona']),
    worldContext: readScenarioSnapshot(value['worldContext']),
    ...(avatarTraits !== undefined ? { avatarTraits } : {}),
  }
}

function readLegacyAvatarSections(
  value: Record<string, unknown>,
): RecordedAvatarContextSnapshot['sections'] {
  const retrievedContext = isRecord(value['knowledge'])
    ? readAvatarKnowledge(value['knowledge'])
    : undefined
  const avatarTraits = isRecord(value['avatarTraits'])
    ? readRecordedAvatarTraits(value['avatarTraits'])
    : undefined
  return {
    directorNotes: readStringOrNull(value['gmNotes']),
    responseRules: { count: readNumber(value['responseRuleCount']) },
    conversationState: {
      recentExchanges: readRecentExchanges(value),
      workingMemory: readAvatarWorkingMemory(value),
      longTermFacts: readLongTermFacts(value),
    },
    ...(retrievedContext !== undefined ? { retrievedContext } : {}),
    userPersona: readUserPersona(value['userPersona']),
    worldContext: readScenarioSnapshot(value['scenario']),
    ...(avatarTraits !== undefined ? { avatarTraits } : {}),
  }
}

function readGmSections(value: Record<string, unknown>): RecordedGmContextSnapshot['sections'] {
  const retrievedContext = isRecord(value['retrievedContext'])
    ? readGmKnowledge(value['retrievedContext'])
    : undefined
  return {
    conversationState: {
      recentMessages: readRecentMessages(value['conversationState']),
      memory: readGmMemory(value['conversationState']),
    },
    ...(retrievedContext !== undefined ? { retrievedContext } : {}),
    userPersona: readUserPersona(value['userPersona']),
    worldContext: readScenarioSnapshot(value['worldContext']),
  }
}

function readLegacyGmSections(
  value: Record<string, unknown>,
): RecordedGmContextSnapshot['sections'] {
  const retrievedContext = isRecord(value['knowledge'])
    ? readGmKnowledge(value['knowledge'])
    : undefined
  return {
    conversationState: {
      recentMessages: readRecentMessages(value),
      memory: readGmMemory(value),
    },
    ...(retrievedContext !== undefined ? { retrievedContext } : {}),
    userPersona: readUserPersona(value['userPersona']),
    worldContext: readScenarioSnapshot(value['scenario']),
  }
}

function readRecentExchanges(
  value: unknown,
): RecordedAvatarContextSnapshot['sections']['conversationState']['recentExchanges'] {
  const record = isRecord(value) ? value : {}
  const rawValue = Array.isArray(record['recentExchanges']) ? record['recentExchanges'] : value
  if (!Array.isArray(rawValue)) return []
  return rawValue
    .map((entry) => {
      if (!isRecord(entry)) return null
      const user = readOptionalString(entry['user'])
      const avatar = readOptionalString(entry['avatar'])
      if (user === undefined || avatar === undefined) return null
      return { user, avatar }
    })
    .filter(
      (
        entry,
      ): entry is RecordedAvatarContextSnapshot['sections']['conversationState']['recentExchanges'][number] =>
        entry !== null,
    )
}

function readAvatarWorkingMemory(
  value: unknown,
): RecordedAvatarContextSnapshot['sections']['conversationState']['workingMemory'] {
  const record = isRecord(value) ? value : {}
  const workingMemory = isRecord(record['workingMemory']) ? record['workingMemory'] : record
  return {
    ...(isRecord(workingMemory['session'])
      ? { session: readWorkingSession(workingMemory['session']) }
      : {}),
    ...(isRecord(workingMemory['avatar'])
      ? { avatar: readWorkingAvatar(workingMemory['avatar']) }
      : {}),
  }
}

function readWorkingSession(
  value: Record<string, unknown>,
): NonNullable<
  RecordedAvatarContextSnapshot['sections']['conversationState']['workingMemory']['session']
> {
  return {
    summary: readString(value['summary']),
    updatedAt: readString(value['updatedAt']),
  }
}

function readWorkingAvatar(
  value: Record<string, unknown>,
): NonNullable<
  RecordedAvatarContextSnapshot['sections']['conversationState']['workingMemory']['avatar']
> {
  return {
    avatarId: readString(value['avatarId']),
    summary: readString(value['summary']),
    updatedAt: readString(value['updatedAt']),
  }
}

function readLongTermFacts(
  value: unknown,
): RecordedAvatarContextSnapshot['sections']['conversationState']['longTermFacts'] {
  const record = isRecord(value) ? value : {}
  const rawValue = Array.isArray(record['longTermFacts']) ? record['longTermFacts'] : value
  if (!Array.isArray(rawValue)) return []
  return rawValue
    .map((entry) => {
      if (!isRecord(entry)) return null
      const category = readOptionalString(entry['category'])
      const key = readOptionalString(entry['key'])
      const factValue = readOptionalString(entry['value'])
      if (category === undefined || key === undefined || factValue === undefined) {
        return null
      }
      return { category, key, value: factValue }
    })
    .filter(
      (
        entry,
      ): entry is RecordedAvatarContextSnapshot['sections']['conversationState']['longTermFacts'][number] =>
        entry !== null,
    )
}

function readAvatarKnowledge(
  value: Record<string, unknown>,
): RecordedAvatarContextSnapshot['sections']['retrievedContext'] | undefined {
  const typedSectionsValue = isRecord(value['typedSections']) ? value['typedSections'] : undefined
  const typedSections =
    typedSectionsValue !== undefined
      ? readRecordedTypedSections(typedSectionsValue)
      : Array.isArray(value['memory']) ||
          Array.isArray(value['world']) ||
          Array.isArray(value['media'])
        ? readRecordedTypedSections(value)
        : groupRecordedKnowledgeReferences(readRecordedKnowledgeReferences(value['retrievedItems']))
  if (!hasRecordedKnowledge(typedSections)) return undefined
  return typedSections
}

function readGmMemory(
  value: unknown,
): RecordedGmContextSnapshot['sections']['conversationState']['memory'] {
  const record = isRecord(value) ? value : {}
  const memory = isRecord(record['memory']) ? record['memory'] : record
  const workingMemory = readOptionalGmWorkingMemory(memory['workingMemory'])
  const workingSummary = readOptionalString(memory['workingSummary'])
  return {
    ...(isRecord(memory['shortTerm'])
      ? {
          shortTerm: {
            recentExchanges: readRecentExchanges(memory['shortTerm']),
          },
        }
      : {}),
    ...(workingMemory !== undefined ? { workingMemory } : {}),
    ...(workingSummary !== undefined ? { workingSummary } : {}),
    ...(Array.isArray(memory['longTermFacts'])
      ? { longTermFacts: readLongTermFacts(memory['longTermFacts']) }
      : {}),
  }
}

function readOptionalGmWorkingMemory(
  value: unknown,
): RecordedGmContextSnapshot['sections']['conversationState']['memory']['workingMemory'] {
  if (!isRecord(value)) return undefined
  const summary = readOptionalString(value['summary'])
  if (summary === undefined) return undefined
  return {
    summary,
    unresolvedThreads: readOptionalStringArray(value['unresolvedThreads']) ?? [],
    coveredTopics: readOptionalStringArray(value['coveredTopics']) ?? [],
  }
}

function readGmKnowledge(
  value: Record<string, unknown>,
): RecordedGmContextSnapshot['sections']['retrievedContext'] | undefined {
  const typedSections = readRecordedTypedSections(value)
  return hasRecordedKnowledge(typedSections) ? typedSections : undefined
}

function readRecentMessages(
  value: unknown,
): RecordedGmContextSnapshot['sections']['conversationState']['recentMessages'] {
  const record = isRecord(value) ? value : {}
  const rawValue = Array.isArray(record['recentMessages']) ? record['recentMessages'] : value
  if (!Array.isArray(rawValue)) return []
  return rawValue
    .map((entry) => {
      if (!isRecord(entry)) return null
      const role = entry['role']
      const content = readOptionalString(entry['content'])
      if ((role !== 'user' && role !== 'avatar' && role !== 'system') || content === undefined) {
        return null
      }
      return { role, content }
    })
    .filter(
      (
        entry,
      ): entry is RecordedGmContextSnapshot['sections']['conversationState']['recentMessages'][number] =>
        entry !== null,
    )
}

function readAvailableAvatars(value: unknown): RecordedGmContextSnapshot['availableAvatars'] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      if (!isRecord(entry)) return null
      const avatarId = readOptionalString(entry['avatarId'])
      const name = readOptionalString(entry['name'])
      if (avatarId === undefined || name === undefined) return null
      const availability = entry['availability']
      return {
        avatarId,
        name,
        ...(typeof entry['description'] === 'string' ? { description: entry['description'] } : {}),
        ...(typeof entry['scope'] === 'string' ? { scope: entry['scope'] } : {}),
        ...(availability === 'available' || availability === 'locked' ? { availability } : {}),
      }
    })
    .filter(
      (entry): entry is RecordedGmContextSnapshot['availableAvatars'][number] => entry !== null,
    )
}

function readUserPersona(value: unknown): UserPersona | null {
  if (!isRecord(value)) return null
  const persona: UserPersona = {}
  const name = readOptionalString(value['name'])
  const roleInWorld = readOptionalString(value['roleInWorld'])
  if (name !== undefined) persona.name = name
  if (roleInWorld !== undefined) persona.roleInWorld = roleInWorld
  const avatarRelationships = readOptionalStringArray(value['avatarRelationships'])
  const dialogGuidance = readOptionalString(value['dialogGuidance'])
  if (avatarRelationships !== undefined) persona.avatarRelationships = avatarRelationships
  if (dialogGuidance !== undefined) persona.dialogGuidance = dialogGuidance
  return Object.keys(persona).length > 0 ? persona : null
}

function readScenarioSnapshot(
  value: unknown,
): RecordedAvatarContextSnapshot['sections']['worldContext'] {
  const record = isRecord(value) ? value : {}
  const name = readOptionalString(record['name'])
  const description = readOptionalString(record['description'])
  return {
    scenarioId: readString(record['scenarioId']),
    ...(name !== undefined ? { name } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(Array.isArray(record['goals']) ? { goals: readStringArray(record['goals']) } : {}),
  }
}

function readRecordedResponseRules(
  value: unknown,
): RecordedAvatarContextSnapshot['sections']['responseRules'] {
  const record = isRecord(value) ? value : {}
  return {
    count: readNumber(record['count'] ?? value),
  }
}

function readRecordedAvatarTraits(
  value: Record<string, unknown>,
): NonNullable<RecordedAvatarContextSnapshot['sections']['avatarTraits']> {
  const sectionCounts = isRecord(value['sectionCounts']) ? value['sectionCounts'] : value
  return {
    sectionCounts: {
      identity: readNumber(sectionCounts['identity']),
      personality: readNumber(sectionCounts['personality']),
      speakingStyle: readNumber(sectionCounts['speakingStyle']),
      background: readNumber(sectionCounts['background']),
      timeline: readNumber(sectionCounts['timeline']),
      currentSituation: readNumber(sectionCounts['currentSituation']),
      behaviouralRules: readNumber(sectionCounts['behaviouralRules']),
    },
  }
}

function readRecordedKnowledgeReferences(value: unknown): RecordedKnowledgeReference[] {
  if (!Array.isArray(value)) return []
  return value
    .map(readRecordedKnowledgeReference)
    .filter((entry): entry is RecordedKnowledgeReference => entry !== null)
}

function readRecordedTypedSections(value: Record<string, unknown>): {
  memory: RecordedKnowledgeReference[]
  world: RecordedKnowledgeReference[]
  media: RecordedKnowledgeReference[]
} {
  return {
    memory: readRecordedKnowledgeReferences(value['memory']),
    world: readRecordedKnowledgeReferences(value['world']),
    media: readRecordedKnowledgeReferences(value['media']),
  }
}

function groupRecordedKnowledgeReferences(items: RecordedKnowledgeReference[]): {
  memory: RecordedKnowledgeReference[]
  world: RecordedKnowledgeReference[]
  media: RecordedKnowledgeReference[]
} {
  return items.reduce(
    (grouped, item) => {
      grouped[item.knowledgeType].push(item)
      return grouped
    },
    {
      memory: [] as RecordedKnowledgeReference[],
      world: [] as RecordedKnowledgeReference[],
      media: [] as RecordedKnowledgeReference[],
    },
  )
}

function hasRecordedKnowledge(value: {
  memory: RecordedKnowledgeReference[]
  world: RecordedKnowledgeReference[]
  media: RecordedKnowledgeReference[]
}): boolean {
  return value.memory.length > 0 || value.world.length > 0 || value.media.length > 0
}

// eslint-disable-next-line complexity
function readRecordedKnowledgeReference(entry: unknown): RecordedKnowledgeReference | null {
  if (!isRecord(entry)) return null
  const sourceId = readOptionalString(entry['sourceId'])
  const chunkId = readOptionalString(entry['chunkId'])
  const knowledgeType = entry['knowledgeType']
  if (
    sourceId === undefined ||
    chunkId === undefined ||
    (knowledgeType !== 'memory' && knowledgeType !== 'world' && knowledgeType !== 'media')
  ) {
    return null
  }
  const item: RecordedKnowledgeReference = {
    sourceId,
    chunkId,
    knowledgeType,
    ...(typeof entry['content'] === 'string' ? { content: entry['content'] } : {}),
    ...(typeof entry['score'] === 'number' ? { score: entry['score'] } : {}),
    ...(typeof entry['reason'] === 'string' ? { reason: entry['reason'] } : {}),
    ...(readRecordedMatchedQuery(entry['matchedQuery']) !== undefined
      ? { matchedQuery: readRecordedMatchedQuery(entry['matchedQuery']) }
      : {}),
    ...(Array.isArray(entry['visibleToAvatarIds'])
      ? { visibleToAvatarIds: readStringArray(entry['visibleToAvatarIds']) }
      : {}),
  }
  return item
}

function readRecordedMatchedQuery(
  value: unknown,
): NonNullable<RecordedKnowledgeReference['matchedQuery']> | undefined {
  if (!isRecord(value)) return undefined
  const source = value['source']
  const text = readOptionalString(value['text'])
  if (
    (source !== 'gm_guideline' &&
      source !== 'gm_retrieval_query' &&
      source !== 'gm_required_fact' &&
      source !== 'last_user_input' &&
      source !== 'working_memory' &&
      source !== 'world_context' &&
      source !== 'direct_query') ||
    text === undefined
  ) {
    return undefined
  }
  return { source, text }
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function readStringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function readOptionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter((item): item is string => typeof item === 'string')
}

function readOptionalCandidateFacts(
  value: unknown,
): Array<{ category: string; key: string; value: string }> | undefined {
  if (!Array.isArray(value)) return undefined

  const facts: Array<{ category: string; key: string; value: string }> = []
  for (const item of value) {
    if (!isRecord(item)) continue
    const category = readOptionalString(item['category'])
    const key = readOptionalString(item['key'])
    const factValue = readOptionalString(item['value'])
    if (category === undefined || key === undefined || factValue === undefined) continue
    facts.push({ category, key, value: factValue })
  }
  return facts
}

function readOptionalStringField<
  K extends
    | 'routingAvatarId'
    | 'routingReason'
    | 'switchedAvatarId'
    | 'correlationId'
    | 'injectedNote'
    | 'objectiveId',
>(value: Record<string, unknown>, key: K): Partial<Record<K, string>> {
  const field = readOptionalString(value[key])
  return field !== undefined ? ({ [key]: field } as Partial<Record<K, string>>) : {}
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function readOptionalStringArrayField(
  value: Record<string, unknown>,
  key: 'unlockedAvatarIds',
): { unlockedAvatarIds?: string[] } {
  const field = readStringArray(value[key])
  return field.length > 0 ? { unlockedAvatarIds: field } : {}
}

function readOptionalNumberField<T extends 'retrievalLatencyMs' | 'otherOverheadMs'>(
  value: Record<string, unknown>,
  key: T,
): Partial<Record<T, number>> {
  const field = readOptionalNumber(value[key])
  return field !== undefined ? ({ [key]: field } as Partial<Record<T, number>>) : {}
}

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function readBoolean(value: unknown): boolean {
  return value === true
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

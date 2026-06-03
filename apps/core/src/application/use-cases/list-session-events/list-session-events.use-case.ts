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
  const candidateFacts = readOptionalCandidateFacts(payload['candidateFacts'])
  const exchangeCount = readOptionalNumber(payload['exchangeCount'])
  const error = readOptionalString(payload['error'])
  return {
    ...base,
    ...(workingSummary !== undefined ? { workingSummary } : {}),
    ...(messageCount !== undefined ? { messageCount } : {}),
    ...(unresolvedThreads !== undefined ? { unresolvedThreads } : {}),
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
  const contextSelection = readOptionalContextSelection(payload['contextSelection'])
  const avatarContext = readOptionalAvatarContextSnapshot(payload['avatarContext'])
  return {
    conversationId: readString(payload['conversationId']),
    turnIndex: readNumber(payload['turnIndex']),
    avatarId: readString(payload['avatarId']),
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

  const knowledge = isRecord(value['knowledge'])
    ? readAvatarKnowledge(value['knowledge'])
    : undefined
  return {
    ...(typeof value['avatarId'] === 'string' ? { avatarId: value['avatarId'] } : {}),
    recentExchanges: readRecentExchanges(value['recentExchanges']),
    workingMemory: readAvatarWorkingMemory(value['workingMemory']),
    longTermFacts: readLongTermFacts(value['longTermFacts']),
    ...(knowledge !== undefined ? { knowledge } : {}),
    userPersona: readUserPersona(value['userPersona']),
    gmNotes: readStringOrNull(value['gmNotes']),
    scenario: readScenarioSnapshot(value['scenario']),
  }
}

function readOptionalGmContextSnapshot(value: unknown): RecordedGmContextSnapshot | undefined {
  if (!isRecord(value)) return undefined

  const knowledge = isRecord(value['knowledge']) ? readGmKnowledge(value['knowledge']) : undefined
  return {
    recentMessages: readRecentMessages(value['recentMessages']),
    memory: readGmMemory(value['memory']),
    ...(knowledge !== undefined ? { knowledge } : {}),
    currentState: readFullStateSummary(value['currentState']),
    availableAvatars: readAvailableAvatars(value['availableAvatars']),
    userPersona: readUserPersona(value['userPersona']),
    scenario: readScenarioSnapshot(value['scenario']),
  }
}

function readOptionalContextSelection(
  value: unknown,
): TurnCompletedEventPayload['contextSelection'] | undefined {
  if (!isRecord(value)) return undefined
  const retrievalCountsValue = isRecord(value['retrievalCounts']) ? value['retrievalCounts'] : {}
  const visibility = readOptionalVisibilitySelection(value['visibility'])
  return {
    shortTermExchangeCount: readNumber(value['shortTermExchangeCount']),
    hasWorkingMemory: readBoolean(value['hasWorkingMemory']),
    longTermFactCount: readNumber(value['longTermFactCount']),
    retrievalCounts: {
      memory: readNumber(retrievalCountsValue['memory']),
      world: readNumber(retrievalCountsValue['world']),
      media: readNumber(retrievalCountsValue['media']),
    },
    ...(visibility !== undefined ? { visibility } : {}),
    hasUserPersona: readBoolean(value['hasUserPersona']),
    hasGmDirective: readBoolean(value['hasGmDirective']),
  }
}

function readOptionalVisibilitySelection(
  value: unknown,
): NonNullable<TurnCompletedEventPayload['contextSelection']>['visibility'] | undefined {
  if (!isRecord(value)) return undefined
  const excludedCountsValue = isRecord(value['excludedCounts']) ? value['excludedCounts'] : {}
  const gmRetrievalCountsValue = isRecord(value['gmRetrievalCounts'])
    ? value['gmRetrievalCounts']
    : undefined
  return {
    ...(typeof value['activeAvatarId'] === 'string'
      ? { activeAvatarId: value['activeAvatarId'] }
      : {}),
    excludedCounts: {
      memory: readNumber(excludedCountsValue['memory']),
      world: readNumber(excludedCountsValue['world']),
      media: readNumber(excludedCountsValue['media']),
    },
    ...(value['gmUnrestricted'] === true ? { gmUnrestricted: true } : {}),
    ...(gmRetrievalCountsValue !== undefined
      ? {
          gmRetrievalCounts: {
            memory: readNumber(gmRetrievalCountsValue['memory']),
            world: readNumber(gmRetrievalCountsValue['world']),
            media: readNumber(gmRetrievalCountsValue['media']),
          },
        }
      : {}),
  }
}

function readStateSummary(value: unknown): GameMasterStateSummary {
  const record = isRecord(value) ? value : {}
  return {
    ...(typeof record['currentAvatarId'] === 'string'
      ? { currentAvatarId: record['currentAvatarId'] }
      : {}),
    progression: typeof record['progression'] === 'string' ? record['progression'] : '',
    topicsCovered: readStringArray(record['topicsCovered']),
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

function readDecision(value: unknown): GmSessionEventPayload['decision'] | undefined {
  if (!isRecord(value)) return undefined
  const conversationMode = value['conversationMode']
  const unlockEvaluations = readOptionalUnlockEvaluations(value['unlockEvaluations'])
  return {
    avatarId: typeof value['avatarId'] === 'string' ? value['avatarId'] : '',
    conversationMode:
      conversationMode === 'new' || conversationMode === 'continue' ? conversationMode : 'continue',
    notesInjected: value['notesInjected'] === true,
    ...readOptionalStringField(value, 'injectedNote'),
    directiveCount: readNumber(value['directiveCount']),
    ...(unlockEvaluations !== undefined ? { unlockEvaluations } : {}),
    ...readOptionalStringField(value, 'suggestedAvatarId'),
    ...readOptionalStringField(value, 'suggestedAvatarReason'),
    ...readOptionalStringField(value, 'switchedAvatarId'),
    ...readOptionalStringArrayField(value, 'unlockedAvatarIds'),
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

function readRecentExchanges(value: unknown): RecordedAvatarContextSnapshot['recentExchanges'] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      if (!isRecord(entry)) return null
      const user = readOptionalString(entry['user'])
      const avatar = readOptionalString(entry['avatar'])
      if (user === undefined || avatar === undefined) return null
      return { user, avatar }
    })
    .filter(
      (entry): entry is RecordedAvatarContextSnapshot['recentExchanges'][number] => entry !== null,
    )
}

function readAvatarWorkingMemory(value: unknown): RecordedAvatarContextSnapshot['workingMemory'] {
  const record = isRecord(value) ? value : {}
  return {
    ...(isRecord(record['session']) ? { session: readWorkingSession(record['session']) } : {}),
    ...(isRecord(record['avatar']) ? { avatar: readWorkingAvatar(record['avatar']) } : {}),
  }
}

function readWorkingSession(
  value: Record<string, unknown>,
): NonNullable<RecordedAvatarContextSnapshot['workingMemory']['session']> {
  return {
    summary: readString(value['summary']),
    updatedAt: readString(value['updatedAt']),
  }
}

function readWorkingAvatar(
  value: Record<string, unknown>,
): NonNullable<RecordedAvatarContextSnapshot['workingMemory']['avatar']> {
  return {
    avatarId: readString(value['avatarId']),
    summary: readString(value['summary']),
    updatedAt: readString(value['updatedAt']),
  }
}

function readLongTermFacts(value: unknown): RecordedAvatarContextSnapshot['longTermFacts'] {
  if (!Array.isArray(value)) return []
  return value
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
      (entry): entry is RecordedAvatarContextSnapshot['longTermFacts'][number] => entry !== null,
    )
}

function readAvatarKnowledge(
  value: Record<string, unknown>,
): RecordedAvatarContextSnapshot['knowledge'] | undefined {
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

function readGmMemory(value: unknown): RecordedGmContextSnapshot['memory'] {
  const record = isRecord(value) ? value : {}
  const workingSummary = readOptionalString(record['workingSummary'])
  return {
    ...(isRecord(record['shortTerm'])
      ? {
          shortTerm: {
            recentExchanges: readRecentExchanges(record['shortTerm']['recentExchanges']),
          },
        }
      : {}),
    ...(workingSummary !== undefined ? { workingSummary } : {}),
    ...(Array.isArray(record['longTermFacts'])
      ? { longTermFacts: readLongTermFacts(record['longTermFacts']) }
      : {}),
  }
}

function readGmKnowledge(
  value: Record<string, unknown>,
): RecordedGmContextSnapshot['knowledge'] | undefined {
  const typedSections = readRecordedTypedSections(value)
  return hasRecordedKnowledge(typedSections) ? typedSections : undefined
}

function readRecentMessages(value: unknown): RecordedGmContextSnapshot['recentMessages'] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      if (!isRecord(entry)) return null
      const role = entry['role']
      const content = readOptionalString(entry['content'])
      if ((role !== 'user' && role !== 'avatar' && role !== 'system') || content === undefined) {
        return null
      }
      return { role, content }
    })
    .filter((entry): entry is RecordedGmContextSnapshot['recentMessages'][number] => entry !== null)
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

function readScenarioSnapshot(value: unknown): RecordedAvatarContextSnapshot['scenario'] {
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
    ...(typeof entry['score'] === 'number' ? { score: entry['score'] } : {}),
    ...(typeof entry['reason'] === 'string' ? { reason: entry['reason'] } : {}),
    ...(Array.isArray(entry['visibleToAvatarIds'])
      ? { visibleToAvatarIds: readStringArray(entry['visibleToAvatarIds']) }
      : {}),
  }
  return item
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
    | 'suggestedAvatarId'
    | 'suggestedAvatarReason'
    | 'switchedAvatarId'
    | 'correlationId'
    | 'injectedNote',
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

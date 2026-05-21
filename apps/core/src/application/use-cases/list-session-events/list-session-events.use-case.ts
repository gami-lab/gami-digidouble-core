import type { IEventLogRepository, StoredEvent } from '../../ports/IEventLogRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
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
  const inputTokens = readOptionalNumber(payload['inputTokens'])
  const outputTokens = readOptionalNumber(payload['outputTokens'])
  const errorCode = readOptionalString(payload['errorCode'])

  return {
    ...safePayload,
    ...(decision !== undefined ? { decision } : {}),
    ...(stateAfter !== undefined ? { stateAfter } : {}),
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
  return {
    conversationId: readString(payload['conversationId']),
    turnIndex: readNumber(payload['turnIndex']),
    avatarId: readString(payload['avatarId']),
    avatarLatencyMs: readNumber(payload['avatarLatencyMs']),
    totalTurnLatencyMs: readNumber(payload['totalTurnLatencyMs']),
    inputTokens: readNumber(payload['inputTokens']),
    outputTokens: readNumber(payload['outputTokens']),
    totalTokens: readNumber(payload['totalTokens']),
    model: readString(payload['model']),
    hasGm: readBoolean(payload['hasGm']),
    ...(contextSelection !== undefined ? { contextSelection } : {}),
    ...readOptionalStringField(payload, 'correlationId'),
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

function readOptionalStateSummary(value: unknown): GameMasterStateSummary | undefined {
  return isRecord(value) ? readStateSummary(value) : undefined
}

function readDecision(value: unknown): GmSessionEventPayload['decision'] | undefined {
  if (!isRecord(value)) return undefined
  const conversationMode = value['conversationMode']
  return {
    avatarId: typeof value['avatarId'] === 'string' ? value['avatarId'] : '',
    conversationMode:
      conversationMode === 'new' || conversationMode === 'continue' ? conversationMode : 'continue',
    notesInjected: value['notesInjected'] === true,
    directiveCount: readNumber(value['directiveCount']),
    ...readOptionalStringField(value, 'suggestedAvatarId'),
    ...readOptionalStringField(value, 'suggestedAvatarReason'),
    ...readOptionalStringField(value, 'switchedAvatarId'),
    ...readOptionalStringArrayField(value, 'unlockedAvatarIds'),
  }
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
  K extends 'suggestedAvatarId' | 'suggestedAvatarReason' | 'switchedAvatarId' | 'correlationId',
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

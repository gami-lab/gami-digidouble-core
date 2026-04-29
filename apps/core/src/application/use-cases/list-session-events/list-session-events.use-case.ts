import type { IEventLogRepository, StoredEvent } from '../../ports/IEventLogRepository.js'
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { GameMasterStateSummary } from '../../../domain/game-master/game-master.types.js'
import { DomainError } from '../../../domain/errors.js'
import type {
  ListSessionEventsInput,
  ListSessionEventsOutput,
  SessionEventRecord,
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

function toSafeSessionEvent(event: StoredEvent): SessionEventRecord[] {
  if (event.type !== 'gm_triggered' && event.type !== 'gm_error') return []
  if (event.correlationId === undefined || event.createdAt === undefined) return []

  return [
    {
      type: event.type,
      correlationId: event.correlationId,
      createdAt: event.createdAt,
      payload: toSafePayload(event.payload),
    },
  ]
}

function toSafePayload(payload: Record<string, unknown>): SessionEventRecord['payload'] {
  const safePayload: SessionEventRecord['payload'] = {
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

function readDecision(value: unknown): SessionEventRecord['payload']['decision'] | undefined {
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

function readOptionalStringField<
  K extends 'suggestedAvatarId' | 'suggestedAvatarReason' | 'switchedAvatarId',
>(value: Record<string, unknown>, key: K): Partial<Record<K, string>> {
  const field = readOptionalString(value[key])
  return field !== undefined ? ({ [key]: field } as Partial<Record<K, string>>) : {}
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

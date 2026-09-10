import {
  isRetrievalFailureCode,
  isRetrievalOutcomeCode,
  isRetrievalQuerySource,
  type RetrievalTraceDto,
} from '@gami/shared'
import type { RetrievalTrace } from '../../../domain/knowledge/knowledge.types.js'

export function toRetrievalTraceDto(trace: RetrievalTrace): RetrievalTraceDto {
  return {
    ...trace,
    ...(trace.embeddingProfile !== undefined
      ? { embeddingProfile: { ...trace.embeddingProfile } }
      : {}),
    ...(trace.timings !== undefined ? { timings: { ...trace.timings } } : {}),
    ...(trace.queries !== undefined
      ? { queries: trace.queries.map((query) => ({ ...query })) }
      : {}),
    ...(trace.failure !== undefined ? { failure: { ...trace.failure } } : {}),
    perType: {
      avatar_knowledge: toTracePerTypeDto(trace.perType.avatar_knowledge),
      world: toTracePerTypeDto(trace.perType.world),
      media: toTracePerTypeDto(trace.perType.media),
    },
  }
}

// eslint-disable-next-line complexity
export function parseRetrievalTraceDto(value: unknown): RetrievalTraceDto | undefined {
  if (!isRecord(value)) return undefined
  const query = readOptionalString(value['query'])
  const perTypeValue = isRecord(value['perType']) ? value['perType'] : undefined
  if (query === undefined || perTypeValue === undefined) return undefined

  const embeddingProfile = readRetrievalEmbeddingProfile(value['embeddingProfile'])
  const timings = readRetrievalTimings(value['timings'])
  const failure = readRetrievalFailure(value['failure'])
  const queries = readRetrievalQueries(value['queries'])
  const outcome = isRetrievalOutcomeCode(value['outcome']) ? value['outcome'] : undefined
  const visibilityMode =
    value['visibilityMode'] === 'avatar_filtered' || value['visibilityMode'] === 'gm_unrestricted'
      ? value['visibilityMode']
      : undefined

  return {
    query,
    perType: {
      avatar_knowledge: readRetrievalTracePerType(perTypeValue['avatar_knowledge']),
      world: readRetrievalTracePerType(perTypeValue['world']),
      media: readRetrievalTracePerType(perTypeValue['media']),
    },
    ...(queries !== undefined ? { queries } : {}),
    ...(embeddingProfile !== undefined ? { embeddingProfile } : {}),
    ...(timings !== undefined ? { timings } : {}),
    ...(failure !== undefined ? { failure } : {}),
    ...(outcome !== undefined ? { outcome } : {}),
    ...(visibilityMode !== undefined ? { visibilityMode } : {}),
    ...(typeof value['gmUnrestricted'] === 'boolean'
      ? { gmUnrestricted: value['gmUnrestricted'] }
      : {}),
    ...readOptionalRetrievalCount(value, 'queryVectorCount'),
    ...readOptionalRetrievalCount(value, 'candidateCount'),
    ...readOptionalRetrievalCount(value, 'selectedCount'),
    ...readOptionalRetrievalCount(value, 'duplicateCount'),
    ...readOptionalRetrievalCount(value, 'selectionExcludedCount'),
    ...readOptionalRetrievalCount(value, 'eligibilityExcludedCount'),
    ...readOptionalRetrievalCount(value, 'excludedCount'),
  }
}

export function presentDistance(value: number): number {
  return roundDiagnosticNumber(Number.isFinite(value) ? Math.max(0, value) : 0)
}

export function presentSimilarity(value: number): number {
  return roundDiagnosticNumber(Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0)
}

function toTracePerTypeDto(
  trace: RetrievalTrace['perType'][keyof RetrievalTrace['perType']],
): RetrievalTraceDto['perType'][keyof RetrievalTraceDto['perType']] {
  return {
    ...trace,
    ...(trace.visibility !== undefined ? { visibility: { ...trace.visibility } } : {}),
  }
}

function readRetrievalTracePerType(
  value: unknown,
): RetrievalTraceDto['perType'][keyof RetrievalTraceDto['perType']] {
  const record = isRecord(value) ? value : {}
  const visibility = readRetrievalVisibility(record['visibility'])
  return {
    sourceIds: readStringArray(record['sourceIds']),
    selectedChunkIds: readStringArray(record['selectedChunkIds']),
    ...(visibility !== undefined ? { visibility } : {}),
    ...readOptionalRetrievalCount(record, 'candidateCount'),
    ...readOptionalRetrievalCount(record, 'selectedCount'),
    ...readOptionalRetrievalCount(record, 'duplicateCount'),
    ...readOptionalRetrievalCount(record, 'selectionExcludedCount'),
    ...readOptionalRetrievalCount(record, 'eligibilityExcludedCount'),
    ...readOptionalRetrievalCount(record, 'excludedCount'),
  }
}

function readRetrievalVisibility(
  value: unknown,
): RetrievalTraceDto['perType']['avatar_knowledge']['visibility'] {
  if (!isRecord(value)) return undefined
  const mode =
    value['mode'] === 'avatar_filtered' || value['mode'] === 'gm_unrestricted'
      ? value['mode']
      : undefined
  return {
    consideredChunkCount: readNumber(value['consideredChunkCount']),
    excludedChunkCount: readNumber(value['excludedChunkCount']),
    ...(mode !== undefined ? { mode } : {}),
    ...readOptionalTextField(value, 'activeAvatarId'),
  }
}

function readRetrievalQueries(
  value: unknown,
): NonNullable<RetrievalTraceDto['queries']> | undefined {
  if (!Array.isArray(value)) return undefined
  return value.flatMap((entry) => {
    if (!isRecord(entry) || !isRetrievalQuerySource(entry['source'])) return []
    const text = readOptionalString(entry['text'])
    if (text === undefined) return []
    const queryIndex = readOptionalNumber(entry['queryIndex'])
    return [{ source: entry['source'], text, ...(queryIndex !== undefined ? { queryIndex } : {}) }]
  })
}

function readRetrievalEmbeddingProfile(
  value: unknown,
): RetrievalTraceDto['embeddingProfile'] | undefined {
  if (!isRecord(value)) return undefined
  const provider = readOptionalString(value['provider'])
  const model = readOptionalString(value['model'])
  const dimensions = readOptionalNumber(value['dimensions'])
  if (provider === undefined || model === undefined || dimensions === undefined) return undefined
  return {
    provider,
    model,
    dimensions,
    ...readOptionalTextField(value, 'embeddingProfileId'),
    ...readOptionalTextField(value, 'corpusGenerationId'),
  }
}

function readRetrievalTimings(value: unknown): RetrievalTraceDto['timings'] | undefined {
  if (!isRecord(value)) return undefined
  const totalMs = readOptionalNumber(value['totalMs'])
  const queryEmbeddingMs = readOptionalNumber(value['queryEmbeddingMs'])
  const vectorSearchMs = readOptionalNumber(value['vectorSearchMs'])
  if (totalMs === undefined && queryEmbeddingMs === undefined && vectorSearchMs === undefined) {
    return undefined
  }
  return {
    ...(totalMs !== undefined ? { totalMs } : {}),
    ...(queryEmbeddingMs !== undefined ? { queryEmbeddingMs } : {}),
    ...(vectorSearchMs !== undefined ? { vectorSearchMs } : {}),
  }
}

function readRetrievalFailure(value: unknown): RetrievalTraceDto['failure'] | undefined {
  if (!isRecord(value)) return undefined
  const code = value['code']
  if (!isRetrievalFailureCode(code)) return undefined
  return { code, retryable: value['retryable'] === true }
}

function readOptionalRetrievalCount(
  value: Record<string, unknown>,
  key:
    | 'queryVectorCount'
    | 'candidateCount'
    | 'selectedCount'
    | 'duplicateCount'
    | 'selectionExcludedCount'
    | 'eligibilityExcludedCount'
    | 'excludedCount',
): Partial<
  Pick<
    RetrievalTraceDto,
    | 'queryVectorCount'
    | 'candidateCount'
    | 'selectedCount'
    | 'duplicateCount'
    | 'selectionExcludedCount'
    | 'eligibilityExcludedCount'
    | 'excludedCount'
  >
> {
  const count = readOptionalNumber(value[key])
  return count === undefined ? {} : { [key]: count }
}

function roundDiagnosticNumber(value: number): number {
  return Number(value.toFixed(4))
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}

function readOptionalTextField<T extends string>(
  value: Record<string, unknown>,
  key: T,
): Partial<Record<T, string>> {
  const text = readOptionalString(value[key])
  return text === undefined ? {} : ({ [key]: text } as Partial<Record<T, string>>)
}

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

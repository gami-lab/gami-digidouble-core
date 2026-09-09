import type {
  QueryKnowledgeRetrievalResponse,
  RetrievalTraceDto,
  RetrievedKnowledgeItemDto,
} from '@gami/shared'
import type {
  RetrievalTrace,
  RetrievedKnowledgeItem,
  TypedRetrievalResult,
} from '../../domain/knowledge/knowledge.types.js'

const DEFAULT_MAX_CONTENT_LENGTH = 800

export function presentKnowledgeRetrieval(
  retrieval: TypedRetrievalResult,
  maxContentLength = DEFAULT_MAX_CONTENT_LENGTH,
): QueryKnowledgeRetrievalResponse {
  const toItem = (item: RetrievedKnowledgeItem): RetrievedKnowledgeItemDto => ({
    sourceId: item.sourceId,
    chunkId: item.chunkId,
    knowledgeType: item.knowledgeType,
    content: truncateContent(item.content, maxContentLength),
    ...(item.score !== undefined ? { score: presentSimilarity(item.score) } : {}),
    ...(item.distance !== undefined ? { distance: presentDistance(item.distance) } : {}),
    ...(item.similarity !== undefined ? { similarity: presentSimilarity(item.similarity) } : {}),
    ...(item.queryIndex !== undefined ? { queryIndex: item.queryIndex } : {}),
    ...(item.reason !== undefined ? { reason: item.reason } : {}),
    ...(item.matchedQuery !== undefined ? { matchedQuery: item.matchedQuery } : {}),
    ...(item.metadata !== undefined ? { metadata: item.metadata } : {}),
    ...(item.visibleToAvatarIds !== undefined
      ? { visibleToAvatarIds: item.visibleToAvatarIds }
      : {}),
  })

  return {
    retrieval: {
      ...retrieval,
      memory: retrieval.memory.map(toItem),
      world: retrieval.world.map(toItem),
      media: retrieval.media.map(toItem),
      trace: presentTrace(retrieval.trace),
    },
  }
}

function presentTrace(trace: RetrievalTrace): RetrievalTraceDto {
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
      memory: presentTracePerType(trace.perType.memory),
      world: presentTracePerType(trace.perType.world),
      media: presentTracePerType(trace.perType.media),
    },
  }
}

function presentTracePerType(
  trace: RetrievalTrace['perType'][keyof RetrievalTrace['perType']],
): RetrievalTraceDto['perType'][keyof RetrievalTraceDto['perType']] {
  return {
    ...trace,
    ...(trace.visibility !== undefined ? { visibility: { ...trace.visibility } } : {}),
  }
}

function presentDistance(value: number): number {
  return roundDiagnosticNumber(Number.isFinite(value) ? Math.max(0, value) : 0)
}

function presentSimilarity(value: number): number {
  return roundDiagnosticNumber(Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0)
}

function roundDiagnosticNumber(value: number): number {
  return Number(value.toFixed(4))
}

function truncateContent(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}...`
}

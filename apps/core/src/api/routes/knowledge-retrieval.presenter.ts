import type { QueryKnowledgeRetrievalResponse, RetrievedKnowledgeItemDto } from '@gami/shared'
import type {
  RetrievedKnowledgeItem,
  TypedRetrievalResult,
} from '../../domain/knowledge/knowledge.types.js'
import {
  presentDistance,
  presentSimilarity,
  toRetrievalTraceDto,
} from '../../application/services/knowledge/retrieval-trace-dto.js'

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
      trace: toRetrievalTraceDto(retrieval.trace),
    },
  }
}

function truncateContent(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}...`
}

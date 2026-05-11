import type { QueryKnowledgeRetrievalResponse, TypedKnowledgeRetrievalDto } from '@gami/shared'

const DEFAULT_MAX_CONTENT_LENGTH = 800

export function presentKnowledgeRetrieval(
  retrieval: TypedKnowledgeRetrievalDto,
  maxContentLength = DEFAULT_MAX_CONTENT_LENGTH,
): QueryKnowledgeRetrievalResponse {
  return {
    retrieval: {
      ...retrieval,
      memory: retrieval.memory.map((item) => ({
        ...item,
        content: truncateContent(item.content, maxContentLength),
      })),
      world: retrieval.world.map((item) => ({
        ...item,
        content: truncateContent(item.content, maxContentLength),
      })),
      media: retrieval.media.map((item) => ({
        ...item,
        content: truncateContent(item.content, maxContentLength),
      })),
    },
  }
}

function truncateContent(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}...`
}

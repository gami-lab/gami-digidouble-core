import type { KnowledgeChunkDto } from '@gami/shared'

export type ListKnowledgeChunksInput = {
  sourceId: string
}

export type ListKnowledgeChunksOutput = {
  chunks: KnowledgeChunkDto[]
}

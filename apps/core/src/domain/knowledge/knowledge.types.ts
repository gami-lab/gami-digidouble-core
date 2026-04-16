/**
 * Knowledge domain types.
 *
 * The Knowledge module owns source ingestion, chunking, embedding, and
 * vector search. Retrieval pipeline is implemented in EPIC 4.1.
 */
export interface KnowledgeSource {
  sourceId: string
  scenarioId: string
  name: string
  type: 'pdf' | 'text' | 'markdown' | 'url' | 'media'
  status: 'pending' | 'ready' | 'error'
  uriOrPath: string
  createdAt: string
  metadata?: Record<string, unknown>
}

export interface KnowledgeChunk {
  chunkId: string
  sourceId: string
  content: string
  /** Index of the chunk within the source document. */
  chunkIndex: number
  createdAt: string
}

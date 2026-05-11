import type { KnowledgeSource } from '../../domain/knowledge/knowledge.types.js'

export type LoadedKnowledgeSourceContent = {
  content: string
  metadata?: Record<string, unknown>
}

export interface IKnowledgeSourceContentLoader {
  load(source: KnowledgeSource): Promise<LoadedKnowledgeSourceContent>
}

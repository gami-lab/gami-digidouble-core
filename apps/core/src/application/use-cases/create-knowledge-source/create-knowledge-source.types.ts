import type { KnowledgeSourceDto } from '@gami/shared'

export type CreateKnowledgeSourceInput = {
  scenarioId: string
  name: string
  knowledgeType: 'memory' | 'world' | 'media'
  format: 'pdf' | 'text' | 'markdown' | 'url' | 'media'
  uriOrPath: string
  metadata?: Record<string, unknown>
}

export type CreateKnowledgeSourceOutput = {
  source: KnowledgeSourceDto
}

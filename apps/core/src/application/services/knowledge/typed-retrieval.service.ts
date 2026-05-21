import type { IKnowledgeChunkRepository } from '../../ports/IKnowledgeChunkRepository.js'
import type { IKnowledgeSourceRepository } from '../../ports/IKnowledgeSourceRepository.js'
import type {
  KnowledgeChunk,
  KnowledgeType,
  RetrievedKnowledgeItem,
  TypedRetrievalResult,
} from '../../../domain/knowledge/knowledge.types.js'

const DEFAULT_LIMIT_PER_TYPE = 3

export type TypedRetrievalInput = {
  scenarioId: string
  sessionId?: string
  userId?: string
  conversationId?: string
  query: string
  limitPerType?: number
}

export class TypedRetrievalService {
  constructor(
    private readonly sourceRepository: IKnowledgeSourceRepository,
    private readonly chunkRepository: IKnowledgeChunkRepository,
  ) {}

  async retrieve(input: TypedRetrievalInput): Promise<TypedRetrievalResult> {
    const limit = Math.max(1, input.limitPerType ?? DEFAULT_LIMIT_PER_TYPE)
    const memory = await this.retrieveByType('memory', input, limit)
    const world = await this.retrieveByType('world', input, limit)
    const media = await this.retrieveByType('media', input, limit)

    return {
      memory: memory.items,
      world: world.items,
      media: media.items,
      trace: {
        query: input.query,
        perType: {
          memory: {
            sourceIds: memory.sourceIds,
            selectedChunkIds: memory.items.map((item) => item.chunkId),
          },
          world: {
            sourceIds: world.sourceIds,
            selectedChunkIds: world.items.map((item) => item.chunkId),
          },
          media: {
            sourceIds: media.sourceIds,
            selectedChunkIds: media.items.map((item) => item.chunkId),
          },
        },
      },
    }
  }

  private async retrieveByType(type: KnowledgeType, input: TypedRetrievalInput, limit: number) {
    const sources = await this.sourceRepository.listByScenario({
      scenarioId: input.scenarioId,
      knowledgeType: type,
      status: 'ready',
    })

    const sourceIds = sources.map((source) => source.sourceId)
    if (sourceIds.length === 0) {
      return { sourceIds: [], items: [] as RetrievedKnowledgeItem[] }
    }

    const chunks = await this.chunkRepository.listBySourceIds(sourceIds)
    const scopedChunks =
      type === 'memory' ? chunks.filter((chunk) => isInMemoryScope(chunk, input)) : chunks

    const scored = scopedChunks
      .map((chunk) => ({ chunk, score: scoreChunk(type, chunk, input.query, input) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        if (a.chunk.sourceId !== b.chunk.sourceId)
          return a.chunk.sourceId.localeCompare(b.chunk.sourceId)
        return a.chunk.chunkIndex - b.chunk.chunkIndex
      })
      .slice(0, limit)

    return {
      sourceIds,
      items: scored.map((entry) =>
        toRetrievedItem(type, entry.chunk, entry.score, explainScore(type, entry.chunk, input)),
      ),
    }
  }
}

function isInMemoryScope(chunk: KnowledgeChunk, input: TypedRetrievalInput): boolean {
  const hasScope =
    input.userId !== undefined ||
    input.sessionId !== undefined ||
    input.conversationId !== undefined
  if (!hasScope) return true

  if (!metadataMatches(chunk.metadata, 'userId', input.userId)) return false
  if (!metadataMatches(chunk.metadata, 'sessionId', input.sessionId)) return false
  if (!metadataMatches(chunk.metadata, 'conversationId', input.conversationId)) return false

  return true
}

function metadataMatches(
  metadata: Record<string, unknown> | undefined,
  key: string,
  expected: string | undefined,
): boolean {
  if (expected === undefined) return true
  if (metadata === undefined) return false
  return metadata[key] === expected
}

function toRetrievedItem(
  type: KnowledgeType,
  chunk: KnowledgeChunk,
  score: number,
  reason: string,
): RetrievedKnowledgeItem {
  return {
    sourceId: chunk.sourceId,
    chunkId: chunk.chunkId,
    knowledgeType: type,
    content: chunk.content,
    score: Number(score.toFixed(4)),
    reason,
    ...(chunk.visibleToAvatarIds !== undefined
      ? { visibleToAvatarIds: chunk.visibleToAvatarIds }
      : {}),
    ...(chunk.metadata !== undefined ? { metadata: chunk.metadata } : {}),
  }
}

function scoreChunk(
  type: KnowledgeType,
  chunk: KnowledgeChunk,
  query: string,
  input: TypedRetrievalInput,
): number {
  const overlap = overlapScore(query, chunk.content)
  if (overlap <= 0) return 0

  let boost = 0
  if (type === 'memory') {
    boost += metadataMatch(chunk.metadata, 'userId', input.userId, 0.25)
    boost += metadataMatch(chunk.metadata, 'sessionId', input.sessionId, 0.15)
    boost += metadataMatch(chunk.metadata, 'conversationId', input.conversationId, 0.1)
  }
  if (type === 'media') {
    boost += metadataTokenBoost(chunk.metadata, 'tags', query, 0.1)
  }

  return overlap + boost
}

function explainScore(
  type: KnowledgeType,
  chunk: KnowledgeChunk,
  input: TypedRetrievalInput,
): string {
  if (type === 'memory') {
    const reasons: string[] = ['token-overlap']
    if (metadataEquals(chunk.metadata, 'userId', input.userId)) reasons.push('user-match')
    if (metadataEquals(chunk.metadata, 'sessionId', input.sessionId)) reasons.push('session-match')
    if (metadataEquals(chunk.metadata, 'conversationId', input.conversationId)) {
      reasons.push('conversation-match')
    }
    return reasons.join('+')
  }
  if (type === 'media' && metadataTokenBoost(chunk.metadata, 'tags', input.query, 0.1) > 0) {
    return 'token-overlap+tag-match'
  }
  return 'token-overlap'
}

function overlapScore(query: string, content: string): number {
  const queryTokens = tokenize(query)
  const contentTokens = new Set(tokenize(content))
  if (queryTokens.length === 0) return 0

  let matches = 0
  for (const token of queryTokens) {
    if (contentTokens.has(token)) matches += 1
  }

  return matches / queryTokens.length
}

function metadataMatch(
  metadata: Record<string, unknown> | undefined,
  key: string,
  expected: string | undefined,
  boost: number,
): number {
  if (expected === undefined || metadata === undefined) return 0
  return metadata[key] === expected ? boost : 0
}

function metadataEquals(
  metadata: Record<string, unknown> | undefined,
  key: string,
  expected: string | undefined,
): boolean {
  if (expected === undefined || metadata === undefined) return false
  return metadata[key] === expected
}

function metadataTokenBoost(
  metadata: Record<string, unknown> | undefined,
  key: string,
  query: string,
  boost: number,
): number {
  if (metadata === undefined) return 0
  const tags = metadata[key]
  if (!Array.isArray(tags)) return 0

  const tagTokens = new Set(
    tags.filter((tag): tag is string => typeof tag === 'string').flatMap(tokenize),
  )
  const queryTokens = tokenize(query)
  if (queryTokens.some((token) => tagTokens.has(token))) return boost
  return 0
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
}

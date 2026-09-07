import type { EmbeddingProfile } from './IEmbeddingAdapter.js'
import type { EmbeddingVector, KnowledgeChunk } from '../../domain/knowledge/knowledge.types.js'

export const MAX_REINDEX_FAILURE_DETAILS_LENGTH = 1000

export type PersistedEmbeddingProfile = Readonly<
  EmbeddingProfile & {
    embeddingProfileId: string
    createdAt: string
  }
>

export type CorpusGenerationStatus = 'staging' | 'validated' | 'active' | 'superseded' | 'failed'

export type CorpusGeneration = Readonly<{
  corpusGenerationId: string
  embeddingProfileId: string
  status: CorpusGenerationStatus
  expectedSourceCount: number
  createdAt: string
  validatedAt?: string
  activatedAt?: string
}>

export type ReindexOperationStatus = 'pending' | 'running' | 'completed' | 'failed'

export type ReindexOperation = Readonly<{
  reindexOperationId: string
  corpusGenerationId: string
  embeddingProfileId: string
  expectedActiveProfileId?: string
  expectedActiveGenerationId?: string
  status: ReindexOperationStatus
  attempts: number
  expectedSourceCount: number
  completedSourceCount: number
  createdAt: string
  startedAt?: string
  completedAt?: string
  failureDetails?: string
}>

export type ReindexSourceStatus = 'pending' | 'running' | 'completed' | 'failed'

export type ReindexSourceProgress = Readonly<{
  reindexOperationId: string
  sourceId: string
  status: ReindexSourceStatus
  attempts: number
  expectedChunkCount?: number
  completedChunkCount: number
  startedAt?: string
  completedAt?: string
  failureDetails?: string
}>

export type StagedKnowledgeChunk = Readonly<{
  sourceId: string
  content: string
  chunkIndex: number
  embedding: EmbeddingVector
  embeddingProfileId: string
  corpusGenerationId: string
  metadata?: Record<string, unknown>
  visibleToAvatarIds?: string[]
}>

export type ActiveSourceChunkReplacement = Readonly<{
  sourceId: string
  embeddingProfileId: string
  corpusGenerationId: string
  chunks: readonly StagedKnowledgeChunk[]
}>

export type CorpusValidation = Readonly<{
  valid: boolean
  corpusGenerationId: string
  embeddingProfileId: string
  expectedSourceCount: number
  completedSourceCount: number
  expectedChunkCount: number
  actualChunkCount: number
  nonNullVectorCount: number
  failureDetails?: string
}>

export type CreateReindexOperationParams = Readonly<{
  embeddingProfileId: string
  sourceIds: readonly string[]
  reindexOperationId?: string
  corpusGenerationId?: string
}>

export type UpdateReindexOperationParams = Readonly<{
  status: ReindexOperationStatus
  attempts?: number
  startedAt?: string
  completedAt?: string
  failureDetails?: string
}>

export type UpdateReindexSourceProgressParams = Readonly<{
  status: ReindexSourceStatus
  attempts?: number
  expectedChunkCount?: number
  completedChunkCount?: number
  startedAt?: string
  completedAt?: string
  failureDetails?: string
}>

export type ActiveCorpus = Readonly<{
  corpusGenerationId: string
  embeddingProfileId: string
  profile: EmbeddingProfile
}>

export interface IKnowledgeCorpusRepository {
  createEmbeddingProfile(profile: EmbeddingProfile): Promise<PersistedEmbeddingProfile>
  findEmbeddingProfile(embeddingProfileId: string): Promise<PersistedEmbeddingProfile | null>
  createReindexOperation(params: CreateReindexOperationParams): Promise<ReindexOperation>
  claimReindexOperation(reindexOperationId: string): Promise<ReindexOperation | null>
  recoverRunningReindexOperations(): Promise<string[]>
  findReindexOperation(reindexOperationId: string): Promise<ReindexOperation | null>
  updateReindexOperation(
    reindexOperationId: string,
    updates: UpdateReindexOperationParams,
  ): Promise<ReindexOperation | null>
  listReindexSourceProgress(reindexOperationId: string): Promise<ReindexSourceProgress[]>
  updateReindexSourceProgress(
    reindexOperationId: string,
    sourceId: string,
    updates: UpdateReindexSourceProgressParams,
  ): Promise<ReindexSourceProgress | null>
  replaceStagedSourceChunks(
    reindexOperationId: string,
    sourceId: string,
    chunks: readonly StagedKnowledgeChunk[],
  ): Promise<number>
  replaceActiveSourceChunks(replacement: ActiveSourceChunkReplacement): Promise<number>
  validateCorpusGeneration(reindexOperationId: string): Promise<CorpusValidation>
  promoteCorpusGeneration(reindexOperationId: string): Promise<ActiveCorpus>
  getActiveCorpus(): Promise<ActiveCorpus | null>
  listActiveChunksBySourceIds(sourceIds: readonly string[]): Promise<KnowledgeChunk[]>
}

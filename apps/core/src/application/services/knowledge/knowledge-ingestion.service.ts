/* eslint-disable max-lines */

import crypto from 'node:crypto'
import { INGESTION_CHUNK_SIZE_DEFAULT } from '@gami/shared'
import { stripNonDescriptiveMetadata } from '../../../domain/knowledge/knowledge-source-presenter.js'
import {
  EmbeddingAdapterError,
  type EmbeddingBatchResult,
  type EmbeddingProfile,
  type IEmbeddingAdapter,
} from '../../ports/IEmbeddingAdapter.js'
import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'
import type { IIngestionJobRepository } from '../../ports/IIngestionJobRepository.js'
import type { IKnowledgeChunkRepository } from '../../ports/IKnowledgeChunkRepository.js'
import type {
  ActiveCorpus,
  IKnowledgeCorpusRepository,
  StagedKnowledgeChunk,
} from '../../ports/IKnowledgeCorpusRepository.js'
import type { IKnowledgeSourceContentLoader } from '../../ports/IKnowledgeSourceContentLoader.js'
import type { IKnowledgeSourceRepository } from '../../ports/IKnowledgeSourceRepository.js'
import type { KnowledgeSource } from '../../../domain/knowledge/knowledge.types.js'

export type IngestionExecutionInput = {
  sourceId: string
  ingestionJobId: string
  correlationId?: string
}

export type IngestionExecutionResult =
  | {
      status: 'completed'
      ingestionJobId: string
      sourceId: string
      chunkCount: number
    }
  | {
      status: 'failed'
      ingestionJobId: string
      sourceId: string
      errorMessage: string
    }

export class KnowledgeIngestionError extends Error {
  constructor(
    readonly code:
      | 'no_active_corpus'
      | 'vector_count_mismatch'
      | 'profile_mismatch'
      | 'dimension_mismatch'
      | 'malformed_response'
      | 'stale_profile',
    message: string,
    readonly retryable: boolean,
  ) {
    super(message)
    this.name = 'KnowledgeIngestionError'
  }
}
export class KnowledgeIngestionService {
  constructor(
    private readonly sourceRepository: IKnowledgeSourceRepository,
    private readonly chunkRepository: IKnowledgeChunkRepository,
    private readonly jobRepository: IIngestionJobRepository,
    private readonly contentLoader: IKnowledgeSourceContentLoader,
    private readonly embeddingAdapter: IEmbeddingAdapter,
    private readonly eventLogRepository: IEventLogRepository,
    private readonly knowledgeCorpusRepository?: Pick<
      IKnowledgeCorpusRepository,
      'getActiveCorpus' | 'listActiveChunksBySourceIds' | 'replaceActiveSourceChunks'
    >,
  ) {}

  async execute(input: IngestionExecutionInput): Promise<IngestionExecutionResult> {
    const context = await this.loadExecutionContext(input)
    if (context === null) {
      return this.notFoundResult(input)
    }
    const { activeCorpus, hadActiveSource, job, nextAttempts, requestId, source } = context
    try {
      const chunkCount = await this.persistIngestionChunks(
        source,
        job.ingestionJobId,
        job.chunkSize,
        activeCorpus,
      )
      return await this.completeJob({
        input,
        source,
        requestId,
        nextAttempts,
        chunkCount,
        jobId: job.ingestionJobId,
        activeCorpus,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown ingestion error.'
      return await this.failJob({
        input,
        source,
        requestId,
        nextAttempts,
        errorMessage,
        jobId: job.ingestionJobId,
        activeCorpus,
        hadActiveSource,
        error,
      })
    }
  }

  private notFoundResult(input: IngestionExecutionInput): IngestionExecutionResult {
    return {
      status: 'failed',
      ingestionJobId: input.ingestionJobId,
      sourceId: input.sourceId,
      errorMessage: 'Source or ingestion job not found.',
    }
  }

  private async loadExecutionContext(input: IngestionExecutionInput): Promise<{
    source: KnowledgeSource
    job: { ingestionJobId: string; attempts: number; chunkSize?: number }
    requestId: string
    nextAttempts: number
    activeCorpus: ActiveCorpus | null
    hadActiveSource: boolean
  } | null> {
    const source = await this.sourceRepository.findById(input.sourceId)
    const job = await this.jobRepository.findById(input.ingestionJobId)
    if (source === null || job === null || job.sourceId !== source.sourceId) return null
    if (this.knowledgeCorpusRepository === undefined) {
      throw new KnowledgeIngestionError(
        'no_active_corpus',
        'An active knowledge corpus repository is required for ingestion.',
        false,
      )
    }
    const activeCorpus = await this.knowledgeCorpusRepository.getActiveCorpus()
    const activeChunks =
      activeCorpus === null
        ? []
        : await this.knowledgeCorpusRepository.listActiveChunksBySourceIds([source.sourceId])
    const hadActiveSource = source.status === 'ready' && activeChunks.length > 0

    const requestId = crypto.randomUUID()
    const nextAttempts = job.attempts + 1
    await this.jobRepository.updateStatus(job.ingestionJobId, {
      status: 'running',
      attempts: nextAttempts,
      startedAt: new Date().toISOString(),
    })
    await this.appendEventSafe({
      type: 'knowledge_ingestion_started',
      severity: 'info',
      requestId,
      ...(input.correlationId !== undefined ? { correlationId: input.correlationId } : {}),
      payload: {
        ingestionJobId: job.ingestionJobId,
        sourceId: source.sourceId,
        scenarioId: source.scenarioId,
        knowledgeType: source.knowledgeType,
        format: source.format,
        ...(activeCorpus !== null ? embeddingDiagnostics(activeCorpus) : {}),
      },
    })

    return { source, job, requestId, nextAttempts, activeCorpus, hadActiveSource }
  }

  private async persistIngestionChunks(
    source: KnowledgeSource,
    jobId: string,
    chunkSize: number | undefined,
    activeCorpus: ActiveCorpus | null,
  ): Promise<number> {
    if (activeCorpus === null) {
      throw new KnowledgeIngestionError(
        'no_active_corpus',
        'No active embedding profile is available for ingestion.',
        true,
      )
    }
    const corpusRepository = this.knowledgeCorpusRepository
    if (corpusRepository === undefined) {
      throw new KnowledgeIngestionError(
        'no_active_corpus',
        'An active knowledge corpus repository is required for ingestion.',
        false,
      )
    }
    const loaded = await this.contentLoader.load(source)
    const chunkSeeds = toChunkSeeds(source, loaded.content, loaded.metadata, chunkSize)
    if (chunkSeeds.length === 0) {
      throw new KnowledgeIngestionError(
        'vector_count_mismatch',
        'Ingestion produced no chunks to vectorize.',
        false,
      )
    }
    const embeddingResult = await this.embeddingAdapter.embed({
      inputs: chunkSeeds.map((chunk) => chunk.content),
    })
    validateEmbeddingResult(embeddingResult, activeCorpus.profile, chunkSeeds.length)
    const chunks: StagedKnowledgeChunk[] = chunkSeeds.map((chunk, index) => ({
      sourceId: source.sourceId,
      content: chunk.content,
      chunkIndex: chunk.chunkIndex,
      embedding: [...(embeddingResult.vectors[index] ?? [])],
      embeddingProfileId: activeCorpus.embeddingProfileId,
      corpusGenerationId: activeCorpus.corpusGenerationId,
      ...(source.visibleToAvatarIds !== undefined
        ? { visibleToAvatarIds: [...source.visibleToAvatarIds] }
        : {}),
      metadata: {
        ...chunk.metadata,
        ingestionJobId: jobId,
      },
    }))
    try {
      return await corpusRepository.replaceActiveSourceChunks({
        sourceId: source.sourceId,
        embeddingProfileId: activeCorpus.embeddingProfileId,
        corpusGenerationId: activeCorpus.corpusGenerationId,
        chunks,
      })
    } catch (error) {
      if (isStaleCorpusError(error)) {
        throw new KnowledgeIngestionError(
          'stale_profile',
          'The active embedding profile or corpus generation changed during ingestion.',
          true,
        )
      }
      throw error
    }
  }

  private async completeJob(args: {
    input: IngestionExecutionInput
    source: KnowledgeSource
    requestId: string
    nextAttempts: number
    chunkCount: number
    jobId: string
    activeCorpus: ActiveCorpus | null
  }): Promise<IngestionExecutionResult> {
    await this.sourceRepository.updateStatus(args.source.sourceId, 'ready')
    await this.jobRepository.updateStatus(args.jobId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      errorMessage: '',
    })
    await this.appendEventSafe({
      type: 'knowledge_ingestion_completed',
      severity: 'info',
      requestId: args.requestId,
      ...(args.input.correlationId !== undefined
        ? { correlationId: args.input.correlationId }
        : {}),
      payload: {
        ingestionJobId: args.jobId,
        sourceId: args.source.sourceId,
        chunkCount: args.chunkCount,
        attempts: args.nextAttempts,
        ...embeddingDiagnostics(args.activeCorpus),
        vectorCount: args.chunkCount,
      },
    })
    return {
      status: 'completed',
      ingestionJobId: args.jobId,
      sourceId: args.source.sourceId,
      chunkCount: args.chunkCount,
    }
  }

  private async failJob(args: {
    input: IngestionExecutionInput
    source: KnowledgeSource
    requestId: string
    nextAttempts: number
    errorMessage: string
    jobId: string
    activeCorpus: ActiveCorpus | null
    hadActiveSource: boolean
    error: unknown
  }): Promise<IngestionExecutionResult> {
    if (!args.hadActiveSource) {
      await this.sourceRepository.updateStatus(args.source.sourceId, 'error')
    }
    await this.jobRepository.updateStatus(args.jobId, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      errorMessage: args.errorMessage,
    })
    await this.appendEventSafe({
      type: 'knowledge_ingestion_failed',
      severity: 'error',
      requestId: args.requestId,
      ...(args.input.correlationId !== undefined
        ? { correlationId: args.input.correlationId }
        : {}),
      payload: {
        ingestionJobId: args.jobId,
        sourceId: args.source.sourceId,
        attempts: args.nextAttempts,
        errorMessage: args.errorMessage,
        ...embeddingDiagnostics(args.activeCorpus),
        vectorCount: 0,
        staleProfile: isStaleCorpusError(args.error),
        ...(args.error instanceof KnowledgeIngestionError
          ? { ingestionFailureCode: args.error.code }
          : {}),
        ...(args.error instanceof EmbeddingAdapterError
          ? { embeddingFailureCode: args.error.failure.code }
          : {}),
      },
    })
    return {
      status: 'failed',
      ingestionJobId: args.jobId,
      sourceId: args.source.sourceId,
      errorMessage: args.errorMessage,
    }
  }

  private async appendEventSafe(args: Parameters<IEventLogRepository['append']>[0]): Promise<void> {
    try {
      await this.eventLogRepository.append(args)
    } catch (error) {
      console.error('[knowledge-ingestion] Event log append failed:', error)
    }
  }
}

function embeddingDiagnostics(activeCorpus: ActiveCorpus | null): Record<string, unknown> {
  if (activeCorpus === null) return {}
  return {
    embeddingProfileId: activeCorpus.embeddingProfileId,
    provider: activeCorpus.profile.provider,
    model: activeCorpus.profile.model,
    dimensions: activeCorpus.profile.dimensions,
    corpusGenerationId: activeCorpus.corpusGenerationId,
  }
}

export function validateEmbeddingResult(
  result: EmbeddingBatchResult,
  expectedProfile: EmbeddingProfile,
  expectedCount: number,
): void {
  const actualCount = Array.isArray(result.vectors) ? result.vectors.length : 0
  if (!Array.isArray(result.vectors) || actualCount !== expectedCount) {
    throw new KnowledgeIngestionError(
      'vector_count_mismatch',
      `Embedding result returned ${String(actualCount)} vectors for ${String(expectedCount)} chunks.`,
      false,
    )
  }
  if (!sameProfile(result.metadata.profile, expectedProfile)) {
    throw new KnowledgeIngestionError(
      'profile_mismatch',
      'Embedding result profile does not match the active profile snapshot.',
      true,
    )
  }
  for (const [index, vector] of result.vectors.entries()) {
    if (!Array.isArray(vector)) {
      throw new KnowledgeIngestionError(
        'malformed_response',
        `Embedding vector ${String(index)} is not an array.`,
        false,
      )
    }
    if (vector.length !== expectedProfile.dimensions) {
      throw new KnowledgeIngestionError(
        'dimension_mismatch',
        `Embedding vector ${String(index)} has ${String(vector.length)} dimensions; expected ${String(expectedProfile.dimensions)}.`,
        false,
      )
    }
    if (vector.some((value) => !Number.isFinite(value))) {
      throw new KnowledgeIngestionError(
        'dimension_mismatch',
        `Embedding vector ${String(index)} contains a non-finite value.`,
        false,
      )
    }
  }
}

function sameProfile(left: EmbeddingProfile, right: EmbeddingProfile): boolean {
  return (
    left.provider === right.provider &&
    left.model === right.model &&
    left.dimensions === right.dimensions
  )
}

function isStaleCorpusError(error: unknown): boolean {
  return (
    (error instanceof KnowledgeIngestionError && error.code === 'stale_profile') ||
    (error instanceof Error &&
      error.message.includes('active embedding profile or corpus generation changed'))
  )
}

type ChunkSeed = {
  content: string
  chunkIndex: number
  metadata: Record<string, unknown>
}

type ParsedParagraph = {
  content: string
  headers: string[]
}

type MarkdownHeading = {
  level: number
  content: string
}

export function toChunkSeeds(
  source: KnowledgeSource,
  content: string,
  loadedMetadata?: Record<string, unknown>,
  chunkSize?: number,
): ChunkSeed[] {
  if (source.format === 'media') return toMediaChunk(source, loadedMetadata)
  const normalized = content.trim()
  if (normalized.length === 0) {
    return [
      {
        content: `Reference source: ${source.uriOrPath}`,
        chunkIndex: 0,
        metadata: buildChunkMetadata(source, loadedMetadata),
      },
    ]
  }

  const paragraphs = parseParagraphsWithHeaders(normalized)
  const chunks: ChunkSeed[] = []
  const maxLength = chunkSize ?? INGESTION_CHUNK_SIZE_DEFAULT

  let current = ''
  let currentHeaders: string[] = []
  for (const paragraph of paragraphs.length > 0
    ? paragraphs
    : [{ content: normalized, headers: [] }]) {
    const headerLines = headersToAdd(currentHeaders, paragraph.headers)
    const paragraphWithHeaders = [...headerLines, paragraph.content].join('\n\n')
    if (current.length === 0) {
      current = paragraphWithHeaders
      currentHeaders = paragraph.headers
      continue
    }
    if (`${current}\n\n${paragraphWithHeaders}`.length <= maxLength) {
      current = `${current}\n\n${paragraphWithHeaders}`
      currentHeaders = paragraph.headers
      continue
    }
    chunks.push({
      content: current,
      chunkIndex: chunks.length,
      metadata: buildChunkMetadata(source, loadedMetadata),
    })
    current = [...paragraph.headers, paragraph.content].join('\n\n')
    currentHeaders = paragraph.headers
  }

  if (current.length > 0) {
    chunks.push({
      content: current,
      chunkIndex: chunks.length,
      metadata: buildChunkMetadata(source, loadedMetadata),
    })
  }

  return chunks
}

function parseParagraphsWithHeaders(content: string): ParsedParagraph[] {
  const lines = content.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n')
  const paragraphs: ParsedParagraph[] = []
  const activeHeaders: Array<string | undefined> = []
  const paragraphLines: string[] = []
  let insideCodeFence = false

  const flushParagraph = (): void => {
    const paragraph = paragraphLines.join('\n').trim()
    paragraphLines.length = 0
    if (paragraph.length === 0) return

    paragraphs.push({
      content: paragraph,
      headers: activeHeaders.filter((header): header is string => header !== undefined),
    })
  }

  for (const line of lines) {
    if (insideCodeFence) {
      paragraphLines.push(line)
      if (isCodeFenceLine(line)) insideCodeFence = false
      continue
    }

    if (isCodeFenceLine(line)) {
      paragraphLines.push(line)
      insideCodeFence = true
      continue
    }

    const heading = parseMarkdownHeading(line)
    if (heading !== null) {
      flushParagraph()
      activeHeaders.length = heading.level
      activeHeaders[heading.level - 1] = heading.content
      continue
    }

    if (line.trim().length === 0) {
      flushParagraph()
      continue
    }

    paragraphLines.push(line.trimEnd())
  }

  flushParagraph()
  return paragraphs
}

function parseMarkdownHeading(line: string): MarkdownHeading | null {
  const match = /^\s{0,3}(#{1,6})(?:[ \t]+|(?=[^\s#]))(.+?)\s*#*\s*$/.exec(line)
  if (match === null) return null

  const marker = match[1]
  const headingText = match[2]
  if (marker === undefined || headingText === undefined) return null

  const content = headingText.replace(/\s+#+\s*$/, '').trim()
  if (content.length === 0) return null

  return {
    level: marker.length,
    content: line.trim(),
  }
}

function isCodeFenceLine(line: string): boolean {
  return /^\s*(```|~~~)/.test(line)
}

function headersToAdd(currentHeaders: string[], nextHeaders: string[]): string[] {
  let commonPrefixLength = 0
  while (
    commonPrefixLength < currentHeaders.length &&
    commonPrefixLength < nextHeaders.length &&
    currentHeaders[commonPrefixLength] === nextHeaders[commonPrefixLength]
  ) {
    commonPrefixLength += 1
  }

  const startsAfterShorterHeaderPath = nextHeaders.length < currentHeaders.length
  const startIndex = startsAfterShorterHeaderPath
    ? Math.max(0, commonPrefixLength - 1)
    : commonPrefixLength
  return nextHeaders.slice(startIndex)
}

function toMediaChunk(
  source: KnowledgeSource,
  loadedMetadata?: Record<string, unknown>,
): ChunkSeed[] {
  const mediaDescription =
    readString(loadedMetadata?.['description']) ?? `Media reference: ${source.uriOrPath}`
  return [
    {
      content: mediaDescription,
      chunkIndex: 0,
      metadata: {
        mediaUri: source.uriOrPath,
        ...buildChunkMetadata(source, loadedMetadata),
      },
    },
  ]
}

function buildChunkMetadata(
  source: KnowledgeSource,
  loadedMetadata?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    sourceFormat: source.format,
    knowledgeType: source.knowledgeType,
    ...(stripNonDescriptiveMetadata(loadedMetadata) ?? {}),
  }
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

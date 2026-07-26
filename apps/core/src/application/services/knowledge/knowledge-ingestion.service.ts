import crypto from 'node:crypto'
import { stripNonDescriptiveMetadata } from '../../../domain/knowledge/knowledge-source-presenter.js'
import type { IEmbeddingAdapter } from '../../ports/IEmbeddingAdapter.js'
import type { IEventLogRepository } from '../../ports/IEventLogRepository.js'
import type { IIngestionJobRepository } from '../../ports/IIngestionJobRepository.js'
import type { IKnowledgeChunkRepository } from '../../ports/IKnowledgeChunkRepository.js'
import type { IKnowledgeSourceContentLoader } from '../../ports/IKnowledgeSourceContentLoader.js'
import type { IKnowledgeSourceRepository } from '../../ports/IKnowledgeSourceRepository.js'
import type { KnowledgeChunk, KnowledgeSource } from '../../../domain/knowledge/knowledge.types.js'

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

export class KnowledgeIngestionService {
  constructor(
    private readonly sourceRepository: IKnowledgeSourceRepository,
    private readonly chunkRepository: IKnowledgeChunkRepository,
    private readonly jobRepository: IIngestionJobRepository,
    private readonly contentLoader: IKnowledgeSourceContentLoader,
    private readonly embeddingAdapter: IEmbeddingAdapter,
    private readonly eventLogRepository: IEventLogRepository,
  ) {}

  async execute(input: IngestionExecutionInput): Promise<IngestionExecutionResult> {
    const context = await this.loadExecutionContext(input)
    if (context === null) {
      return this.notFoundResult(input)
    }
    const { job, nextAttempts, requestId, source } = context
    try {
      const chunkCount = await this.persistIngestionChunks(source, job.ingestionJobId)
      return await this.completeJob({
        input,
        source,
        requestId,
        nextAttempts,
        chunkCount,
        jobId: job.ingestionJobId,
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
    job: { ingestionJobId: string; attempts: number }
    requestId: string
    nextAttempts: number
  } | null> {
    const source = await this.sourceRepository.findById(input.sourceId)
    const job = await this.jobRepository.findById(input.ingestionJobId)
    if (source === null || job === null || job.sourceId !== source.sourceId) return null

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
      },
    })

    return { source, job, requestId, nextAttempts }
  }

  private async persistIngestionChunks(source: KnowledgeSource, jobId: string): Promise<number> {
    const loaded = await this.contentLoader.load(source)
    const chunkSeeds = toChunkSeeds(source, loaded.content, loaded.metadata)
    const embeddings =
      chunkSeeds.length === 0
        ? []
        : await this.embeddingAdapter.embed(chunkSeeds.map((chunk) => chunk.content))

    const previousChunks = await this.chunkRepository.listBySourceId(source.sourceId)
    await this.chunkRepository.deleteBySourceId(source.sourceId)
    try {
      for (const [index, chunk] of chunkSeeds.entries()) {
        await this.chunkRepository.create({
          sourceId: source.sourceId,
          content: chunk.content,
          chunkIndex: chunk.chunkIndex,
          ...(embeddings[index] !== undefined ? { embedding: embeddings[index] } : {}),
          ...(source.visibleToAvatarIds !== undefined
            ? { visibleToAvatarIds: source.visibleToAvatarIds }
            : {}),
          metadata: {
            ...chunk.metadata,
            ingestionJobId: jobId,
          },
        })
      }
    } catch (error) {
      await this.restorePreviousChunks(source.sourceId, previousChunks)
      throw error
    }

    return chunkSeeds.length
  }

  private async restorePreviousChunks(
    sourceId: string,
    previousChunks: KnowledgeChunk[],
  ): Promise<void> {
    await this.chunkRepository.deleteBySourceId(sourceId)
    for (const chunk of previousChunks) {
      await this.chunkRepository.create({
        sourceId,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        ...(chunk.embedding !== undefined ? { embedding: chunk.embedding } : {}),
        ...(chunk.metadata !== undefined ? { metadata: chunk.metadata } : {}),
      })
    }
  }

  private async completeJob(args: {
    input: IngestionExecutionInput
    source: KnowledgeSource
    requestId: string
    nextAttempts: number
    chunkCount: number
    jobId: string
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
  }): Promise<IngestionExecutionResult> {
    await this.sourceRepository.updateStatus(args.source.sourceId, 'error')
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

function toChunkSeeds(
  source: KnowledgeSource,
  content: string,
  loadedMetadata?: Record<string, unknown>,
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
  const maxLength = source.format === 'markdown' ? 1000 : 800

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

import { INGESTION_CHUNK_HARD_MAX, INGESTION_CHUNK_SIZE_DEFAULT } from '@gami/shared'
import { stripNonDescriptiveMetadata } from '../../../domain/knowledge/knowledge-source-presenter.js'
import type { KnowledgeSource } from '../../../domain/knowledge/knowledge.types.js'
import { hashKnowledgeChunkContent } from '../../../domain/knowledge/knowledge-content-hash.js'

type ChunkSeed = {
  content: string
  contentHash: string
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
        contentHash: hashKnowledgeChunkContent(`Reference source: ${source.uriOrPath}`),
        chunkIndex: 0,
        metadata: buildChunkMetadata(source, loadedMetadata),
      },
    ]
  }

  const paragraphs = parseParagraphsWithHeaders(normalized)
  const chunks: ChunkSeed[] = []
  const maxLength = Math.min(chunkSize ?? INGESTION_CHUNK_SIZE_DEFAULT, INGESTION_CHUNK_HARD_MAX)
  const paragraphsToChunk = (
    paragraphs.length > 0 ? paragraphs : [{ content: normalized, headers: [] }]
  ).flatMap((paragraph) => splitParsedParagraph(paragraph, maxLength))

  let current = ''
  let currentHeaders: string[] = []
  const flushCurrent = (): void => {
    if (current.length === 0) return
    appendBoundedChunk(chunks, current, source, loadedMetadata)
    current = ''
  }

  for (const paragraph of paragraphsToChunk) {
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
    flushCurrent()
    current = [...paragraph.headers, paragraph.content].join('\n\n')
    currentHeaders = paragraph.headers
  }

  flushCurrent()

  return chunks
}

function splitParsedParagraph(paragraph: ParsedParagraph, maxLength: number): ParsedParagraph[] {
  const headerText = headersToAdd([], paragraph.headers).join('\n\n')
  const headerSeparatorLength = headerText.length > 0 ? 2 : 0
  const contentMaxLength = Math.max(1, maxLength - headerText.length - headerSeparatorLength - 2)

  return splitParagraphContent(paragraph.content, contentMaxLength).map((content) => ({
    content,
    headers: paragraph.headers,
  }))
}

function splitParagraphContent(content: string, maxLength: number): string[] {
  if (content.length <= maxLength) return [content]

  if (/^\s*(```|~~~)/m.test(content)) return splitRawText(content, maxLength)

  const pieces: string[] = []
  let remaining = content
  while (remaining.length > maxLength) {
    const cutAt = findSentenceCut(remaining, maxLength) ?? maxLength
    pieces.push(remaining.slice(0, cutAt))
    remaining = remaining.slice(cutAt)
  }
  if (remaining.length > 0) pieces.push(remaining)
  return pieces
}

function findSentenceCut(content: string, maxLength: number): number | null {
  const sentenceEnd = /[.!?](?:["'’)\]]+)?(?=\s|$)/g
  let lastCut: number | null = null
  for (const match of content.slice(0, maxLength + 1).matchAll(sentenceEnd)) {
    const end = match.index + match[0].length
    if (end <= maxLength) lastCut = end
  }
  return lastCut
}

function splitRawText(content: string, maxLength: number): string[] {
  const pieces: string[] = []
  for (let offset = 0; offset < content.length; offset += maxLength) {
    pieces.push(content.slice(offset, offset + maxLength))
  }
  return pieces
}

function appendBoundedChunk(
  chunks: ChunkSeed[],
  content: string,
  source: KnowledgeSource,
  loadedMetadata?: Record<string, unknown>,
): void {
  const pieces =
    content.length <= INGESTION_CHUNK_HARD_MAX
      ? [content]
      : splitRawText(content, INGESTION_CHUNK_HARD_MAX)

  for (const piece of pieces) {
    chunks.push({
      content: piece,
      contentHash: hashKnowledgeChunkContent(piece),
      chunkIndex: chunks.length,
      metadata: buildChunkMetadata(source, loadedMetadata),
    })
  }
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
      contentHash: hashKnowledgeChunkContent(mediaDescription),
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

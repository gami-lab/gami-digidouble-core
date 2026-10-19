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
  sectionIndex: number
}

type RenderedText = {
  content: string
  headers: string[]
}

type ChunkDraft = RenderedText & {
  sectionCount: number
}

const MAX_SECTIONS_PER_CHUNK = 3
// Source documents vary their other heading levels freely; only `###` reliably delimits one unit.
const SECTION_HEADING_LEVEL = 3

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
  const sections = groupSections(
    paragraphs.length > 0 ? paragraphs : [{ content: normalized, headers: [], sectionIndex: 0 }],
  )
  for (const content of packSections(sections, maxLength)) {
    appendBoundedChunk(chunks, content, source, loadedMetadata)
  }
  return chunks
}

function packSections(sections: ParsedParagraph[][], maxLength: number): string[] {
  const packed: string[] = []
  let draft: ChunkDraft | null = null
  for (const section of sections) {
    const pieces = section.flatMap((paragraph) => splitParsedParagraph(paragraph, maxLength))
    if (draft !== null && draft.sectionCount < MAX_SECTIONS_PER_CHUNK) {
      const extended = appendParagraphs(draft, pieces)
      if (extended.content.length <= maxLength) {
        draft = { ...extended, sectionCount: draft.sectionCount + 1 }
        continue
      }
    }
    if (draft !== null) packed.push(draft.content)
    draft = null
    const standalone = appendParagraphs(null, pieces)
    if (standalone.content.length <= maxLength) {
      draft = { ...standalone, sectionCount: 1 }
      continue
    }
    packed.push(...splitSection(pieces, standalone.content.length, maxLength))
  }
  if (draft !== null) packed.push(draft.content)
  return packed
}

function groupSections(paragraphs: ParsedParagraph[]): ParsedParagraph[][] {
  const sections: ParsedParagraph[][] = []
  for (const paragraph of paragraphs) {
    const last = sections.at(-1)
    if (last?.[0]?.sectionIndex === paragraph.sectionIndex) last.push(paragraph)
    else sections.push([paragraph])
  }
  return sections
}

function appendParagraphs(draft: RenderedText | null, paragraphs: ParsedParagraph[]): RenderedText {
  let rendered = draft
  for (const paragraph of paragraphs) {
    rendered =
      rendered === null
        ? {
            content: [...paragraph.headers, paragraph.content].join('\n\n'),
            headers: paragraph.headers,
          }
        : {
            content: [
              rendered.content,
              ...headersToAdd(rendered.headers, paragraph.headers),
              paragraph.content,
            ].join('\n\n'),
            headers: paragraph.headers,
          }
  }
  return rendered ?? { content: '', headers: [] }
}

// Balances an oversized section across the fewest chunks so it does not leave a tiny trailing piece.
function splitSection(
  paragraphs: ParsedParagraph[],
  totalLength: number,
  maxLength: number,
): string[] {
  const targetLength = Math.ceil(totalLength / Math.ceil(totalLength / maxLength))
  const pieces: string[] = []
  let current: RenderedText | null = null
  for (const paragraph of paragraphs) {
    const extended = appendParagraphs(current, [paragraph])
    if (current !== null && extended.content.length > maxLength) {
      pieces.push(current.content)
      current = appendParagraphs(null, [paragraph])
    } else {
      current = extended
    }
    if (current.content.length >= targetLength) {
      pieces.push(current.content)
      current = null
    }
  }
  if (current !== null) pieces.push(current.content)
  return pieces
}

function splitParsedParagraph(paragraph: ParsedParagraph, maxLength: number): ParsedParagraph[] {
  const headerText = headersToAdd([], paragraph.headers).join('\n\n')
  const headerSeparatorLength = headerText.length > 0 ? 2 : 0
  const contentMaxLength = Math.max(1, maxLength - headerText.length - headerSeparatorLength - 2)

  return splitParagraphContent(paragraph.content, contentMaxLength).map((content) => ({
    ...paragraph,
    content,
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
  let sectionIndex = 0

  const flushParagraph = (): void => {
    const paragraph = paragraphLines.join('\n').trim()
    paragraphLines.length = 0
    if (paragraph.length === 0) return

    paragraphs.push({
      content: paragraph,
      headers: activeHeaders.filter((header): header is string => header !== undefined),
      sectionIndex,
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
      if (heading.level === SECTION_HEADING_LEVEL) sectionIndex += 1
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

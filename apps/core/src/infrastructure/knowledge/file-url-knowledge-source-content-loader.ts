import { readFile } from 'node:fs/promises'
import path from 'node:path'
import pdfParse from 'pdf-parse'
import type {
  IKnowledgeSourceContentLoader,
  LoadedKnowledgeSourceContent,
} from '../../application/ports/IKnowledgeSourceContentLoader.js'
import type { KnowledgeSource } from '../../domain/knowledge/knowledge.types.js'
import { DomainError } from '../../domain/errors.js'

export type FileUrlKnowledgeSourceContentLoaderOptions = {
  /** Local/mounted directories that uriOrPath may resolve into. Empty by default (no local file access). */
  allowedRoots?: string[]
  fetchImpl?: typeof fetch
  maxContentBytes?: number
  pdfParseImpl?: (buffer: Buffer) => Promise<{ text: string }>
}

const DEFAULT_MAX_CONTENT_BYTES = 10 * 1024 * 1024

/**
 * Production content loader: fetches `url` sources over HTTP(S), reads local/mounted
 * files for `text`/`markdown`/`pdf` under an explicit allowlist, and extracts PDF text.
 */
export class FileUrlKnowledgeSourceContentLoader implements IKnowledgeSourceContentLoader {
  private readonly allowedRoots: string[]
  private readonly fetchImpl: typeof fetch
  private readonly maxContentBytes: number
  private readonly pdfParseImpl: (buffer: Buffer) => Promise<{ text: string }>

  constructor(options: FileUrlKnowledgeSourceContentLoaderOptions = {}) {
    this.allowedRoots = (options.allowedRoots ?? []).map((root) => path.resolve(root))
    this.fetchImpl = options.fetchImpl ?? fetch
    this.maxContentBytes = options.maxContentBytes ?? DEFAULT_MAX_CONTENT_BYTES
    this.pdfParseImpl = options.pdfParseImpl ?? pdfParse
  }

  async load(source: KnowledgeSource): Promise<LoadedKnowledgeSourceContent> {
    const metadata = source.metadata ?? {}
    const inlineText = readString(metadata['inlineText'])
    if (inlineText !== null) {
      return { content: inlineText, metadata }
    }

    if (source.format === 'media') {
      const description =
        readString(metadata['description']) ?? `Media reference: ${source.uriOrPath}`
      return { content: description, metadata }
    }

    const content = await this.loadContent(source)
    return { content, metadata }
  }

  private async loadContent(source: KnowledgeSource): Promise<string> {
    const isRemote = isHttpUrl(source.uriOrPath)

    if (source.format === 'pdf') {
      const buffer = isRemote
        ? await this.fetchBuffer(source.uriOrPath)
        : await this.readLocalBuffer(source.uriOrPath)
      const parsed = await this.pdfParseImpl(buffer)
      return parsed.text.trim()
    }

    return isRemote ? this.fetchText(source.uriOrPath) : this.readLocalText(source.uriOrPath)
  }

  private async fetchBuffer(url: string): Promise<Buffer> {
    const response = await this.fetchImpl(url)
    if (!response.ok) {
      throw new Error(
        `Failed to fetch knowledge source URL "${url}": HTTP ${String(response.status)}`,
      )
    }
    const arrayBuffer = await response.arrayBuffer()
    this.assertWithinSizeLimit(arrayBuffer.byteLength, url)
    return Buffer.from(arrayBuffer)
  }

  private async fetchText(url: string): Promise<string> {
    const response = await this.fetchImpl(url)
    if (!response.ok) {
      throw new Error(
        `Failed to fetch knowledge source URL "${url}": HTTP ${String(response.status)}`,
      )
    }
    const text = await response.text()
    this.assertWithinSizeLimit(Buffer.byteLength(text, 'utf8'), url)
    return text
  }

  private async readLocalBuffer(filePath: string): Promise<Buffer> {
    const resolved = this.resolveAllowedPath(filePath)
    const buffer = await readFile(resolved)
    this.assertWithinSizeLimit(buffer.byteLength, filePath)
    return buffer
  }

  private async readLocalText(filePath: string): Promise<string> {
    const resolved = this.resolveAllowedPath(filePath)
    const text = await readFile(resolved, 'utf8')
    this.assertWithinSizeLimit(Buffer.byteLength(text, 'utf8'), filePath)
    return text
  }

  private resolveAllowedPath(filePath: string): string {
    if (this.allowedRoots.length === 0) {
      throw new DomainError(
        'VALIDATION_ERROR',
        `Local file access is disabled: no allowed roots configured for uriOrPath "${filePath}".`,
      )
    }

    const resolved = path.resolve(filePath)
    const withinAllowedRoot = this.allowedRoots.some(
      (root) => resolved === root || resolved.startsWith(`${root}${path.sep}`),
    )
    if (!withinAllowedRoot) {
      throw new DomainError(
        'VALIDATION_ERROR',
        `Path "${filePath}" is not within an allowed root for knowledge source ingestion.`,
      )
    }
    return resolved
  }

  private assertWithinSizeLimit(byteLength: number, source: string): void {
    if (byteLength > this.maxContentBytes) {
      throw new DomainError(
        'VALIDATION_ERROR',
        `Knowledge source content at "${source}" exceeds the maximum allowed size of ${String(this.maxContentBytes)} bytes.`,
      )
    }
  }
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

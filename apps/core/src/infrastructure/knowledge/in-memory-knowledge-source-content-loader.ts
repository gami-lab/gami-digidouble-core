import type {
  IKnowledgeSourceContentLoader,
  LoadedKnowledgeSourceContent,
} from '../../application/ports/IKnowledgeSourceContentLoader.js'
import type { KnowledgeSource } from '../../domain/knowledge/knowledge.types.js'

export class InMemoryKnowledgeSourceContentLoader implements IKnowledgeSourceContentLoader {
  load(source: KnowledgeSource): Promise<LoadedKnowledgeSourceContent> {
    const metadata = source.metadata ?? {}
    const inlineText = readString(metadata['inlineText'])

    if (inlineText !== null) {
      return Promise.resolve({
        content: inlineText,
        metadata,
      })
    }

    if (source.format === 'media') {
      const description =
        readString(metadata['description']) ?? `Media reference: ${source.uriOrPath}`
      return Promise.resolve({
        content: description,
        metadata,
      })
    }

    return Promise.resolve({
      content: `Reference source: ${source.uriOrPath}`,
      metadata,
    })
  }
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

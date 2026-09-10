import type { KnowledgeSourceDto } from '@gami/shared'
import type { KnowledgeSource } from './knowledge.types.js'

/**
 * Metadata keys that carry full ingestion input content rather than descriptive
 * metadata (e.g. `inlineText` holds the entire pasted/uploaded source text).
 * These are used internally by the content loader and must not be echoed back
 * in API responses — they can be many KB per source and dominate list payloads.
 */
const NON_DESCRIPTIVE_METADATA_KEYS = new Set([
  'content',
  'inlineText',
  'embedding',
  'vector',
  'vectors',
])

function stripNonDescriptiveValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNonDescriptiveValue)
  if (typeof value !== 'object' || value === null) return value

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !NON_DESCRIPTIVE_METADATA_KEYS.has(key))
      .map(([key, nestedValue]) => [key, stripNonDescriptiveValue(nestedValue)]),
  )
}

export function stripNonDescriptiveMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (metadata === undefined) return undefined
  const entries = Object.entries(metadata)
    .filter(([key]) => !NON_DESCRIPTIVE_METADATA_KEYS.has(key))
    .map(([key, value]) => [key, stripNonDescriptiveValue(value)] as const)
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

export function toKnowledgeSourceDto(source: KnowledgeSource): KnowledgeSourceDto {
  const metadata = stripNonDescriptiveMetadata(source.metadata)
  return {
    sourceId: source.sourceId,
    scenarioId: source.scenarioId,
    name: source.name,
    knowledgeType: source.knowledgeType,
    format: source.format,
    uriOrPath: source.uriOrPath,
    status: source.status,
    ...(source.visibilityPolicy !== undefined ? { visibilityPolicy: source.visibilityPolicy } : {}),
    ...(source.visibleToAvatarIds !== undefined
      ? { visibleToAvatarIds: source.visibleToAvatarIds }
      : {}),
    ...(source.quarantine !== undefined
      ? {
          quarantine: {
            classification: source.quarantine.classification,
            reason: source.quarantine.reason,
            offendingKeyNames: [...source.quarantine.offendingKeyNames],
            quarantinedAt: source.quarantine.quarantinedAt,
          },
        }
      : {}),
    createdAt: source.createdAt,
    ...(metadata !== undefined ? { metadata } : {}),
  }
}

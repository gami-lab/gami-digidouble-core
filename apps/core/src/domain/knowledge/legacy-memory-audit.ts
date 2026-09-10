import type { KnowledgeVisibilityPolicy } from './knowledge.types.js'

/** The legacy static category being audited before EPIC 4.2d terminology changes. */
export const LEGACY_STATIC_MEMORY_TYPE = 'memory' as const

/** Reserved metadata keys that would make static knowledge user- or conversation-scoped. */
export const RESERVED_STATIC_SCOPE_KEYS = ['conversationId', 'sessionId', 'userId'] as const

export type LegacyMemoryClassification =
  'shared_avatar_knowledge' | 'shared_world_knowledge' | 'ambiguous_or_invalid_user_specific'

export type LegacyMemoryAuditReason =
  | 'reserved_scope_metadata'
  | 'explicit_avatar_visibility'
  | 'explicit_shared_visibility'
  | 'missing_explicit_visibility'
  | 'inconsistent_visibility'
  | 'avatar_visibility_missing_ids'

export type LegacyMemoryAuditChunk = {
  chunkId: string
  metadata?: unknown
  visibleToAvatarIds?: readonly string[] | null
}

export type LegacyMemoryAuditSource = {
  sourceId: string
  scenarioId: string
  knowledgeType: string
  visibilityPolicy?: KnowledgeVisibilityPolicy | null
  visibleToAvatarIds?: readonly string[] | null
  metadata?: unknown
  chunks: readonly LegacyMemoryAuditChunk[]
}

export type LegacyMemoryAuditRecord = {
  sourceId: string
  scenarioId: string
  currentType: string
  visibility: {
    policy: KnowledgeVisibilityPolicy | null
    visibleToAvatarIds: string[]
    chunkCount: number
    chunksWithAvatarVisibility: number
  }
  offendingKeyNames: string[]
  offendingChunkIds: string[]
  proposedClassification: LegacyMemoryClassification
  reason: LegacyMemoryAuditReason
}

export type LegacyMemoryAuditReport = {
  auditVersion: 1
  dryRun: true
  scannedSourceCount: number
  legacyMemorySourceCount: number
  classificationCounts: Record<LegacyMemoryClassification, number>
  sources: LegacyMemoryAuditRecord[]
}

const MAX_REPORTED_IDS_PER_SOURCE = 100

/**
 * Classifies legacy static sources without looking at source or chunk content.
 *
 * This is deliberately conservative. A missing scope is not evidence that a
 * source is Avatar knowledge; only explicit visibility metadata can classify it.
 */
export function classifyLegacyMemorySources(
  sources: readonly LegacyMemoryAuditSource[],
): LegacyMemoryAuditReport {
  const legacySources = sources
    .filter((source) => source.knowledgeType === LEGACY_STATIC_MEMORY_TYPE)
    .slice()
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId))

  const records = legacySources.map(classifyLegacyMemorySource)
  const classificationCounts: Record<LegacyMemoryClassification, number> = {
    shared_avatar_knowledge: 0,
    shared_world_knowledge: 0,
    ambiguous_or_invalid_user_specific: 0,
  }
  for (const record of records) {
    classificationCounts[record.proposedClassification] += 1
  }

  return {
    auditVersion: 1,
    dryRun: true,
    scannedSourceCount: sources.length,
    legacyMemorySourceCount: records.length,
    classificationCounts,
    sources: records,
  }
}

function classifyLegacyMemorySource(source: LegacyMemoryAuditSource): LegacyMemoryAuditRecord {
  const sourceScopeKeys = collectReservedScopeKeys(source.metadata)
  const chunkScopeKeys = new Map<string, string[]>()
  for (const chunk of source.chunks) {
    const keys = collectReservedScopeKeys(chunk.metadata)
    if (keys.length > 0) chunkScopeKeys.set(chunk.chunkId, keys)
  }

  const offendingKeyNames = [
    ...new Set([...sourceScopeKeys, ...chunkScopeKeys.values()].flat()),
  ].sort()
  const offendingChunkIds = [...chunkScopeKeys.keys()].sort().slice(0, MAX_REPORTED_IDS_PER_SOURCE)
  const visibleToAvatarIds = normalizeIds(source.visibleToAvatarIds)
  const chunksWithAvatarVisibility = source.chunks.filter(
    (chunk) => normalizeIds(chunk.visibleToAvatarIds).length > 0,
  ).length
  const visibility = {
    policy: source.visibilityPolicy ?? null,
    visibleToAvatarIds: visibleToAvatarIds.slice(0, MAX_REPORTED_IDS_PER_SOURCE),
    chunkCount: source.chunks.length,
    chunksWithAvatarVisibility,
  }

  if (offendingKeyNames.length > 0) {
    return {
      sourceId: source.sourceId,
      scenarioId: source.scenarioId,
      currentType: source.knowledgeType,
      visibility,
      offendingKeyNames,
      offendingChunkIds,
      proposedClassification: 'ambiguous_or_invalid_user_specific',
      reason: 'reserved_scope_metadata',
    }
  }

  const decision = classifyVisibility(
    source.visibilityPolicy ?? null,
    visibleToAvatarIds.length > 0,
  )
  return auditRecord(
    source,
    visibility,
    offendingKeyNames,
    offendingChunkIds,
    decision.proposedClassification,
    decision.reason,
  )
}

function classifyVisibility(
  policy: KnowledgeVisibilityPolicy | null,
  hasSourceAvatarVisibility: boolean,
): Pick<LegacyMemoryAuditRecord, 'proposedClassification' | 'reason'> {
  if ((policy === 'avatars' || policy === null) && hasSourceAvatarVisibility) {
    return {
      proposedClassification: 'shared_avatar_knowledge',
      reason: 'explicit_avatar_visibility',
    }
  }
  if (policy === 'avatars') {
    return {
      proposedClassification: 'ambiguous_or_invalid_user_specific',
      reason: 'avatar_visibility_missing_ids',
    }
  }
  if ((policy === 'all' || policy === 'none') && !hasSourceAvatarVisibility) {
    return {
      proposedClassification: 'shared_world_knowledge',
      reason: 'explicit_shared_visibility',
    }
  }
  if (policy === 'all' || policy === 'none') {
    return {
      proposedClassification: 'ambiguous_or_invalid_user_specific',
      reason: 'inconsistent_visibility',
    }
  }
  return {
    proposedClassification: 'ambiguous_or_invalid_user_specific',
    reason: 'missing_explicit_visibility',
  }
}

function auditRecord(
  source: LegacyMemoryAuditSource,
  visibility: LegacyMemoryAuditRecord['visibility'],
  offendingKeyNames: string[],
  offendingChunkIds: string[],
  proposedClassification: LegacyMemoryClassification,
  reason: LegacyMemoryAuditReason,
): LegacyMemoryAuditRecord {
  return {
    sourceId: source.sourceId,
    scenarioId: source.scenarioId,
    currentType: source.knowledgeType,
    visibility,
    offendingKeyNames,
    offendingChunkIds,
    proposedClassification,
    reason,
  }
}

function collectReservedScopeKeys(value: unknown): string[] {
  const found = new Set<string>()
  const visited = new WeakSet()

  function visit(current: unknown): void {
    if (typeof current !== 'object' || current === null) return
    if (visited.has(current)) return
    visited.add(current)

    if (Array.isArray(current)) {
      for (const item of current) visit(item)
      return
    }

    for (const [key, nested] of Object.entries(current)) {
      if ((RESERVED_STATIC_SCOPE_KEYS as readonly string[]).includes(key)) found.add(key)
      visit(nested)
    }
  }

  visit(value)
  return [...found].sort()
}

function normalizeIds(value: readonly string[] | null | undefined): string[] {
  return [...new Set((value ?? []).filter((id) => id.trim().length > 0))].sort()
}

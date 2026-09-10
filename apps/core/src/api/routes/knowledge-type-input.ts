import {
  LEGACY_KNOWLEDGE_TYPE_ALIAS,
  type KnowledgeType,
  type KnowledgeTypeInput,
} from '@gami/shared'
import type { IEventLogRepository } from '../../application/ports/IEventLogRepository.js'

export type NormalizedKnowledgeTypeInput = {
  knowledgeType: KnowledgeType
  usedLegacyAlias: boolean
}

export function normalizeKnowledgeTypeInput(
  knowledgeType: KnowledgeTypeInput,
): NormalizedKnowledgeTypeInput {
  if (knowledgeType === LEGACY_KNOWLEDGE_TYPE_ALIAS) {
    return { knowledgeType: 'avatar_knowledge', usedLegacyAlias: true }
  }
  return { knowledgeType, usedLegacyAlias: false }
}

export async function recordLegacyKnowledgeTypeAlias(
  eventLogRepository: IEventLogRepository,
  usedLegacyAlias: boolean,
): Promise<void> {
  if (!usedLegacyAlias) return
  try {
    await eventLogRepository.append({
      type: 'knowledge_type_legacy_alias_used',
      severity: 'warning',
      payload: {
        field: 'knowledgeType',
        legacyValue: 'memory',
        normalizedValue: 'avatar_knowledge',
      },
    })
  } catch {
    // Avoid coupling knowledge route availability to observability writes.
  }
}

export async function normalizeKnowledgeTypeAtBoundary(
  eventLogRepository: IEventLogRepository,
  knowledgeType: KnowledgeTypeInput,
): Promise<KnowledgeType> {
  const normalized = normalizeKnowledgeTypeInput(knowledgeType)
  await recordLegacyKnowledgeTypeAlias(eventLogRepository, normalized.usedLegacyAlias)
  return normalized.knowledgeType
}

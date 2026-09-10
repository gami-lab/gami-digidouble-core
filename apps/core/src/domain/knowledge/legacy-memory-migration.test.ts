import { describe, expect, it } from 'vitest'
import { buildLegacyMemoryMigrationPlan } from './legacy-memory-migration.js'
import type { LegacyMemoryAuditReport } from './legacy-memory-audit.js'

function reportFor(
  proposedClassification: LegacyMemoryAuditReport['sources'][number]['proposedClassification'],
  sourceId: string,
): LegacyMemoryAuditReport {
  return {
    auditVersion: 1,
    dryRun: true,
    scannedSourceCount: 1,
    legacyMemorySourceCount: 1,
    classificationCounts: {
      shared_avatar_knowledge: 0,
      shared_world_knowledge: 0,
      ambiguous_or_invalid_user_specific: 0,
    },
    sources: [
      {
        sourceId,
        scenarioId: 'scenario_1',
        currentType: 'memory',
        visibility: {
          policy: null,
          visibleToAvatarIds: [],
          chunkCount: 0,
          chunksWithAvatarVisibility: 0,
        },
        offendingKeyNames:
          proposedClassification === 'ambiguous_or_invalid_user_specific' ? ['userId'] : [],
        offendingChunkIds: [],
        proposedClassification,
        reason:
          proposedClassification === 'ambiguous_or_invalid_user_specific'
            ? 'reserved_scope_metadata'
            : 'explicit_shared_visibility',
      },
    ],
  }
}

describe('buildLegacyMemoryMigrationPlan', () => {
  it('maps positively classified Avatar sources to avatar_knowledge', () => {
    const plan = buildLegacyMemoryMigrationPlan(
      reportFor('shared_avatar_knowledge', 'knowledge_source_avatar'),
    )

    expect(plan).toMatchObject({
      actionCounts: { migrateToAvatarKnowledge: 1, migrateToWorld: 0, quarantine: 0 },
      actions: [
        {
          targetKnowledgeType: 'avatar_knowledge',
          targetStatus: 'unchanged',
          quarantine: false,
        },
      ],
    })
  })

  it('maps positively classified world sources to world', () => {
    const plan = buildLegacyMemoryMigrationPlan(
      reportFor('shared_world_knowledge', 'knowledge_source_world'),
    )

    expect(plan.actions[0]).toMatchObject({
      targetKnowledgeType: 'world',
      targetStatus: 'unchanged',
      quarantine: false,
    })
  })

  it('blocks ambiguous sources and retains only safe classification details', () => {
    const plan = buildLegacyMemoryMigrationPlan(
      reportFor('ambiguous_or_invalid_user_specific', 'knowledge_source_ambiguous'),
    )

    expect(plan.actions[0]).toMatchObject({
      targetKnowledgeType: 'avatar_knowledge',
      targetStatus: 'blocked',
      quarantine: true,
      offendingKeyNames: ['userId'],
    })
    expect(JSON.stringify(plan)).not.toContain('content')
    expect(JSON.stringify(plan)).not.toContain('vector')
  })
})

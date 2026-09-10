import type {
  LegacyMemoryAuditRecord,
  LegacyMemoryAuditReport,
  LegacyMemoryClassification,
} from './legacy-memory-audit.js'

export type LegacyMemoryMigrationAction = {
  sourceId: string
  classification: LegacyMemoryClassification
  targetKnowledgeType: 'avatar_knowledge' | 'world'
  targetStatus: 'unchanged' | 'blocked'
  quarantine: boolean
  reason: LegacyMemoryAuditRecord['reason']
  offendingKeyNames: string[]
}

export type LegacyMemoryMigrationPlan = {
  auditVersion: 1
  dryRun: true
  actionCounts: {
    migrateToAvatarKnowledge: number
    migrateToWorld: number
    quarantine: number
  }
  actions: LegacyMemoryMigrationAction[]
}

export function buildLegacyMemoryMigrationPlan(
  report: LegacyMemoryAuditReport,
): LegacyMemoryMigrationPlan {
  const actions = report.sources.map(toMigrationAction)
  return {
    auditVersion: report.auditVersion,
    dryRun: true,
    actionCounts: {
      migrateToAvatarKnowledge: actions.filter(
        (action) => action.targetKnowledgeType === 'avatar_knowledge' && !action.quarantine,
      ).length,
      migrateToWorld: actions.filter((action) => action.targetKnowledgeType === 'world').length,
      quarantine: actions.filter((action) => action.quarantine).length,
    },
    actions,
  }
}

function toMigrationAction(record: LegacyMemoryAuditRecord): LegacyMemoryMigrationAction {
  if (record.proposedClassification === 'shared_world_knowledge') {
    return {
      sourceId: record.sourceId,
      classification: record.proposedClassification,
      targetKnowledgeType: 'world',
      targetStatus: 'unchanged',
      quarantine: false,
      reason: record.reason,
      offendingKeyNames: [...record.offendingKeyNames],
    }
  }

  if (record.proposedClassification === 'shared_avatar_knowledge') {
    return {
      sourceId: record.sourceId,
      classification: record.proposedClassification,
      targetKnowledgeType: 'avatar_knowledge',
      targetStatus: 'unchanged',
      quarantine: false,
      reason: record.reason,
      offendingKeyNames: [...record.offendingKeyNames],
    }
  }

  return {
    sourceId: record.sourceId,
    classification: record.proposedClassification,
    targetKnowledgeType: 'avatar_knowledge',
    targetStatus: 'blocked',
    quarantine: true,
    reason: record.reason,
    offendingKeyNames: [...record.offendingKeyNames],
  }
}

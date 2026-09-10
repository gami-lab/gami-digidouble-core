import { describe, expect, it } from 'vitest'
import { classifyLegacyMemorySources, type LegacyMemoryAuditSource } from './legacy-memory-audit.js'

function source(overrides: Partial<LegacyMemoryAuditSource> = {}): LegacyMemoryAuditSource {
  return {
    sourceId: 'source_1',
    scenarioId: 'scenario_1',
    knowledgeType: 'memory',
    chunks: [],
    ...overrides,
  }
}

describe('classifyLegacyMemorySources', () => {
  it('classifies explicit Avatar visibility as shared Avatar knowledge', () => {
    const report = classifyLegacyMemorySources([
      source({
        visibilityPolicy: 'avatars',
        visibleToAvatarIds: ['avatar_2'],
      }),
    ])

    expect(report.sources[0]).toMatchObject({
      proposedClassification: 'shared_avatar_knowledge',
      reason: 'explicit_avatar_visibility',
      visibility: {
        policy: 'avatars',
        visibleToAvatarIds: ['avatar_2'],
      },
    })
  })

  it.each(['all', 'none'] as const)(
    'classifies explicit %s visibility as shared world knowledge',
    (visibilityPolicy) => {
      const report = classifyLegacyMemorySources([source({ visibilityPolicy })])

      expect(report.sources[0]?.proposedClassification).toBe('shared_world_knowledge')
      expect(report.sources[0]?.reason).toBe('explicit_shared_visibility')
    },
  )

  it('does not infer Avatar ownership from a missing scope', () => {
    const report = classifyLegacyMemorySources([source()])

    expect(report.sources[0]).toMatchObject({
      proposedClassification: 'ambiguous_or_invalid_user_specific',
      reason: 'missing_explicit_visibility',
    })
  })

  it('reports recursive reserved scope keys without exposing metadata values', () => {
    const report = classifyLegacyMemorySources([
      source({
        metadata: {
          inlineText: 'do-not-report-this-source-content',
          nested: [{ userId: 'user_private_value', sessionId: 'session_private_value' }],
        },
        chunks: [
          {
            chunkId: 'chunk_1',
            metadata: { deeper: { conversationId: 'conversation_private_value' } },
          },
        ],
      }),
    ])

    const serialized = JSON.stringify(report)
    expect(report.sources[0]).toMatchObject({
      proposedClassification: 'ambiguous_or_invalid_user_specific',
      reason: 'reserved_scope_metadata',
      offendingKeyNames: ['conversationId', 'sessionId', 'userId'],
      offendingChunkIds: ['chunk_1'],
    })
    expect(serialized).not.toContain('do-not-report-this-source-content')
    expect(serialized).not.toContain('user_private_value')
    expect(serialized).not.toContain('session_private_value')
    expect(serialized).not.toContain('conversation_private_value')
  })

  it('bounds repeated IDs in the safe report', () => {
    const report = classifyLegacyMemorySources([
      source({
        visibleToAvatarIds: Array.from({ length: 101 }, (_, index) => `avatar_${String(index)}`),
        chunks: Array.from({ length: 101 }, (_, index) => ({
          chunkId: `chunk_${String(index)}`,
          metadata: { userId: `user_${String(index)}` },
        })),
      }),
    ])

    expect(report.sources[0]?.visibility.visibleToAvatarIds).toHaveLength(100)
    expect(report.sources[0]?.offendingChunkIds).toHaveLength(100)
  })

  it('reports contradictory visibility instead of silently choosing a category', () => {
    const report = classifyLegacyMemorySources([
      source({ visibilityPolicy: 'all', visibleToAvatarIds: ['avatar_1'] }),
    ])

    expect(report.sources[0]).toMatchObject({
      proposedClassification: 'ambiguous_or_invalid_user_specific',
      reason: 'inconsistent_visibility',
    })
  })

  it('ignores already non-legacy types and keeps counts deterministic', () => {
    const report = classifyLegacyMemorySources([
      source({ sourceId: 'source_b' }),
      source({ sourceId: 'source_a', knowledgeType: 'world' }),
    ])

    expect(report.scannedSourceCount).toBe(2)
    expect(report.legacyMemorySourceCount).toBe(1)
    expect(report.sources.map((item) => item.sourceId)).toEqual(['source_b'])
    expect(report.classificationCounts).toEqual({
      shared_avatar_knowledge: 0,
      shared_world_knowledge: 0,
      ambiguous_or_invalid_user_specific: 1,
    })
  })
})

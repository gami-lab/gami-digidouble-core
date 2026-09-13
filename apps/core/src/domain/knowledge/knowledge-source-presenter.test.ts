import { describe, expect, it } from 'vitest'
import type { KnowledgeSource } from './knowledge.types.js'
import { stripNonDescriptiveMetadata, toKnowledgeSourceDto } from './knowledge-source-presenter.js'

function makeSource(overrides: Partial<KnowledgeSource> = {}): KnowledgeSource {
  return {
    sourceId: 'knowledge_source_1',
    scenarioId: 'scenario_1',
    name: 'Lore',
    knowledgeType: 'world',
    format: 'text',
    uriOrPath: 'inline://lore.txt',
    status: 'ready',
    createdAt: '2026-05-11T08:00:00.000Z',
    updatedAt: '2026-05-11T08:00:00.000Z',
    ...overrides,
  }
}

describe('stripNonDescriptiveMetadata', () => {
  it('removes inlineText but keeps other keys', () => {
    expect(stripNonDescriptiveMetadata({ inlineText: 'full text', tags: ['a'] })).toEqual({
      tags: ['a'],
    })
  })

  it('returns undefined when metadata becomes empty', () => {
    expect(stripNonDescriptiveMetadata({ inlineText: 'full text' })).toBeUndefined()
  })

  it('returns undefined when input is undefined', () => {
    expect(stripNonDescriptiveMetadata(undefined)).toBeUndefined()
  })
})

describe('toKnowledgeSourceDto', () => {
  it('strips inlineText from the returned metadata', () => {
    const dto = toKnowledgeSourceDto(
      makeSource({ metadata: { inlineText: 'A very long document...' } }),
    )

    expect(dto.metadata).toBeUndefined()
  })

  it('keeps descriptive metadata and visibility fields', () => {
    const dto = toKnowledgeSourceDto(
      makeSource({
        metadata: { tags: ['kingdom'] },
        visibilityPolicy: 'avatars',
        visibleToAvatarIds: ['avatar_1'],
      }),
    )

    expect(dto.metadata).toEqual({ tags: ['kingdom'] })
    expect(dto.visibilityPolicy).toBe('avatars')
    expect(dto.visibleToAvatarIds).toEqual(['avatar_1'])
  })
})

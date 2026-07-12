import { describe, expect, it } from 'vitest'
import type { KnowledgeSource } from '../../domain/knowledge/knowledge.types.js'
import { InMemoryKnowledgeSourceRepository } from './in-memory-knowledge-source.repository.js'

function makeSource(overrides: Partial<KnowledgeSource> = {}): KnowledgeSource {
  return {
    sourceId: 'knowledge_source_1',
    scenarioId: 'scenario_1',
    name: 'Lore',
    knowledgeType: 'world',
    format: 'markdown',
    uriOrPath: 's3://bucket/lore.md',
    status: 'pending',
    createdAt: '2026-05-11T08:00:00.000Z',
    updatedAt: '2026-05-11T08:00:00.000Z',
    ...overrides,
  }
}

describe('InMemoryKnowledgeSourceRepository', () => {
  it('creates a source with prefixed id and pending status', async () => {
    const repository = new InMemoryKnowledgeSourceRepository()

    const created = await repository.create({
      scenarioId: 'scenario_1',
      name: 'World rules',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/tmp/rules.txt',
    })

    expect(created.sourceId.startsWith('knowledge_source_')).toBe(true)
    expect(created.status).toBe('pending')
    expect(created.knowledgeType).toBe('world')
    expect(created.format).toBe('text')
    expect(created.visibleToAvatarIds).toBeUndefined()
  })

  it('stores explicit visibleToAvatarIds and normalizes empty lists to default visibility', async () => {
    const repository = new InMemoryKnowledgeSourceRepository()

    const visible = await repository.create({
      scenarioId: 'scenario_1',
      name: 'Private lore',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/tmp/private.txt',
      visibleToAvatarIds: ['avatar_a', ' avatar_b '],
    })
    const publicByEmpty = await repository.create({
      scenarioId: 'scenario_1',
      name: 'Public lore',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/tmp/public.txt',
      visibleToAvatarIds: [],
    })

    expect(visible.visibleToAvatarIds).toEqual(['avatar_a', 'avatar_b'])
    expect(publicByEmpty.visibleToAvatarIds).toBeUndefined()
  })

  it('normalizes visibilityPolicy and avatar ids coherently on create', async () => {
    const repository = new InMemoryKnowledgeSourceRepository()

    const publicSource = await repository.create({
      scenarioId: 'scenario_1',
      name: 'Shared lore',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/tmp/shared.txt',
      visibilityPolicy: 'all',
      visibleToAvatarIds: ['avatar_hidden'],
    })
    const privateSource = await repository.create({
      scenarioId: 'scenario_1',
      name: 'Private lore',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/tmp/private.txt',
      visibleToAvatarIds: ['avatar_a'],
    })

    expect(publicSource.visibilityPolicy).toBe('all')
    expect(publicSource.visibleToAvatarIds).toBeUndefined()
    expect(privateSource.visibilityPolicy).toBe('avatars')
    expect(privateSource.visibleToAvatarIds).toEqual(['avatar_a'])
  })

  it('listByScenario supports knowledgeType and status filtering', async () => {
    const repository = new InMemoryKnowledgeSourceRepository([
      makeSource({ sourceId: 'knowledge_source_a', knowledgeType: 'world', status: 'ready' }),
      makeSource({ sourceId: 'knowledge_source_b', knowledgeType: 'media', status: 'ready' }),
      makeSource({ sourceId: 'knowledge_source_c', knowledgeType: 'world', status: 'error' }),
    ])

    const worldReady = await repository.listByScenario({
      scenarioId: 'scenario_1',
      knowledgeType: 'world',
      status: 'ready',
    })

    expect(worldReady).toHaveLength(1)
    expect(worldReady[0]?.sourceId).toBe('knowledge_source_a')
  })

  it('updateStatus updates status and returns null for unknown ids', async () => {
    const repository = new InMemoryKnowledgeSourceRepository([makeSource()])

    const updated = await repository.updateStatus('knowledge_source_1', 'ready')
    const missing = await repository.updateStatus('knowledge_source_missing', 'ready')

    expect(updated?.status).toBe('ready')
    expect(missing).toBeNull()
  })
})

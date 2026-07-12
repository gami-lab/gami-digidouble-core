import { describe, expect, it } from 'vitest'
import type { KnowledgeSource } from '../../../domain/knowledge/knowledge.types.js'
import { InMemoryKnowledgeSourceRepository } from '../../../infrastructure/db/in-memory-knowledge-source.repository.js'
import { UpdateKnowledgeSourceUseCase } from './update-knowledge-source.use-case.js'

function makeSource(overrides: Partial<KnowledgeSource> = {}): KnowledgeSource {
  return {
    sourceId: 'knowledge_source_1',
    scenarioId: 'scenario_1',
    name: 'Lore',
    knowledgeType: 'world',
    format: 'text',
    uriOrPath: '/tmp/lore.txt',
    status: 'ready',
    createdAt: '2026-05-11T08:00:00.000Z',
    updatedAt: '2026-05-11T08:00:00.000Z',
    ...overrides,
  }
}

describe('UpdateKnowledgeSourceUseCase', () => {
  it('throws INVALID_INPUT when no updatable fields are provided', async () => {
    const useCase = new UpdateKnowledgeSourceUseCase(
      new InMemoryKnowledgeSourceRepository([makeSource()]),
    )

    await expect(useCase.execute({ sourceId: 'knowledge_source_1' })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    })
  })

  it('throws NOT_FOUND when source does not exist', async () => {
    const useCase = new UpdateKnowledgeSourceUseCase(new InMemoryKnowledgeSourceRepository())

    await expect(
      useCase.execute({ sourceId: 'knowledge_source_missing', name: 'New Name' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('updates name without affecting status', async () => {
    const repo = new InMemoryKnowledgeSourceRepository([makeSource()])
    const useCase = new UpdateKnowledgeSourceUseCase(repo)

    const output = await useCase.execute({ sourceId: 'knowledge_source_1', name: 'Updated Lore' })

    expect(output.source.name).toBe('Updated Lore')
    expect(output.source.status).toBe('ready')
  })

  it('resets status to pending when metadata changes', async () => {
    const repo = new InMemoryKnowledgeSourceRepository([makeSource()])
    const useCase = new UpdateKnowledgeSourceUseCase(repo)

    const output = await useCase.execute({
      sourceId: 'knowledge_source_1',
      metadata: { inlineText: 'Updated content' },
    })

    expect(output.source.status).toBe('pending')
    expect(output.source.metadata).toEqual({ inlineText: 'Updated content' })
  })

  it('resets status to pending when uriOrPath changes', async () => {
    const repo = new InMemoryKnowledgeSourceRepository([makeSource()])
    const useCase = new UpdateKnowledgeSourceUseCase(repo)

    const output = await useCase.execute({
      sourceId: 'knowledge_source_1',
      uriOrPath: '/tmp/new-lore.txt',
    })

    expect(output.source.status).toBe('pending')
    expect(output.source.uriOrPath).toBe('/tmp/new-lore.txt')
  })

  it('does not reset status when only visibility changes', async () => {
    const repo = new InMemoryKnowledgeSourceRepository([makeSource()])
    const useCase = new UpdateKnowledgeSourceUseCase(repo)

    const output = await useCase.execute({
      sourceId: 'knowledge_source_1',
      visibleToAvatarIds: ['avatar_a'],
    })

    expect(output.source.status).toBe('ready')
    expect(output.source.visibleToAvatarIds).toEqual(['avatar_a'])
  })

  it('infers avatars visibility when only avatar ids are provided', async () => {
    const repo = new InMemoryKnowledgeSourceRepository([makeSource()])
    const useCase = new UpdateKnowledgeSourceUseCase(repo)

    const output = await useCase.execute({
      sourceId: 'knowledge_source_1',
      visibleToAvatarIds: ['avatar_a', ' avatar_b '],
    })

    expect(output.source.visibilityPolicy).toBe('avatars')
    expect(output.source.visibleToAvatarIds).toEqual(['avatar_a', 'avatar_b'])
  })

  it('clears stale avatar ids when visibility changes to all', async () => {
    const repo = new InMemoryKnowledgeSourceRepository([
      makeSource({
        visibilityPolicy: 'avatars',
        visibleToAvatarIds: ['avatar_a'],
      }),
    ])
    const useCase = new UpdateKnowledgeSourceUseCase(repo)

    const output = await useCase.execute({
      sourceId: 'knowledge_source_1',
      visibilityPolicy: 'all',
    })

    expect(output.source.visibilityPolicy).toBe('all')
    expect(output.source.visibleToAvatarIds).toBeUndefined()
    expect(output.source.status).toBe('ready')
  })

  it('rejects avatars visibility without avatar ids', async () => {
    const repo = new InMemoryKnowledgeSourceRepository([makeSource()])
    const useCase = new UpdateKnowledgeSourceUseCase(repo)

    await expect(
      useCase.execute({
        sourceId: 'knowledge_source_1',
        visibilityPolicy: 'avatars',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })
  })

  it('rejects blank name', async () => {
    const useCase = new UpdateKnowledgeSourceUseCase(
      new InMemoryKnowledgeSourceRepository([makeSource()]),
    )

    await expect(
      useCase.execute({ sourceId: 'knowledge_source_1', name: '   ' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })
})

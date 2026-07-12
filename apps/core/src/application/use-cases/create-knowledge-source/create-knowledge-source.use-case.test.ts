import { describe, expect, it } from 'vitest'
import { InMemoryKnowledgeSourceRepository } from '../../../infrastructure/db/in-memory-knowledge-source.repository.js'
import { CreateKnowledgeSourceUseCase } from './create-knowledge-source.use-case.js'

describe('CreateKnowledgeSourceUseCase', () => {
  it('creates a source with trimmed fields and pending status', async () => {
    const useCase = new CreateKnowledgeSourceUseCase(new InMemoryKnowledgeSourceRepository())

    const output = await useCase.execute({
      scenarioId: ' scenario_1 ',
      name: ' World lore ',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: ' inline://world-lore.txt ',
      metadata: { inlineText: 'Important lore' },
    })

    expect(output.source.scenarioId).toBe('scenario_1')
    expect(output.source.name).toBe('World lore')
    expect(output.source.uriOrPath).toBe('inline://world-lore.txt')
    expect(output.source.status).toBe('pending')
  })

  it('infers avatar-scoped visibility from visibleToAvatarIds', async () => {
    const useCase = new CreateKnowledgeSourceUseCase(new InMemoryKnowledgeSourceRepository())

    const output = await useCase.execute({
      scenarioId: 'scenario_1',
      name: 'Private lore',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: 'inline://private-lore.txt',
      visibleToAvatarIds: ['avatar_1', ' avatar_2 '],
    })

    expect(output.source.visibilityPolicy).toBe('avatars')
    expect(output.source.visibleToAvatarIds).toEqual(['avatar_1', 'avatar_2'])
  })

  it('clears stale avatar ids when visibilityPolicy is all', async () => {
    const useCase = new CreateKnowledgeSourceUseCase(new InMemoryKnowledgeSourceRepository())

    const output = await useCase.execute({
      scenarioId: 'scenario_1',
      name: 'Shared lore',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: 'inline://shared-lore.txt',
      visibilityPolicy: 'all',
      visibleToAvatarIds: ['avatar_hidden'],
    })

    expect(output.source.visibilityPolicy).toBe('all')
    expect(output.source.visibleToAvatarIds).toBeUndefined()
  })

  it('rejects avatars visibility without avatar ids', async () => {
    const useCase = new CreateKnowledgeSourceUseCase(new InMemoryKnowledgeSourceRepository())

    await expect(
      useCase.execute({
        scenarioId: 'scenario_1',
        name: 'Broken lore',
        knowledgeType: 'world',
        format: 'text',
        uriOrPath: 'inline://broken-lore.txt',
        visibilityPolicy: 'avatars',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })
  })
})

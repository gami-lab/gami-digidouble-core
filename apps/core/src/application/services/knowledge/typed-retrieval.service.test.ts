import { describe, expect, it } from 'vitest'
import { InMemoryKnowledgeChunkRepository } from '../../../infrastructure/db/in-memory-knowledge-chunk.repository.js'
import { InMemoryKnowledgeSourceRepository } from '../../../infrastructure/db/in-memory-knowledge-source.repository.js'
import { TypedRetrievalService } from './typed-retrieval.service.js'

async function seed() {
  const sourceRepo = new InMemoryKnowledgeSourceRepository()
  const chunkRepo = new InMemoryKnowledgeChunkRepository()

  const memory = await sourceRepo.create({
    scenarioId: 'scenario_1',
    name: 'Memory source',
    knowledgeType: 'memory',
    format: 'text',
    uriOrPath: '/memory.txt',
  })
  const world = await sourceRepo.create({
    scenarioId: 'scenario_1',
    name: 'World source',
    knowledgeType: 'world',
    format: 'markdown',
    uriOrPath: '/world.md',
  })
  const media = await sourceRepo.create({
    scenarioId: 'scenario_1',
    name: 'Media source',
    knowledgeType: 'media',
    format: 'media',
    uriOrPath: '/media.png',
  })

  await sourceRepo.updateStatus(memory.sourceId, 'ready')
  await sourceRepo.updateStatus(world.sourceId, 'ready')
  await sourceRepo.updateStatus(media.sourceId, 'ready')

  await chunkRepo.create({
    sourceId: memory.sourceId,
    chunkIndex: 0,
    content: 'User prefers concise answers about budget plan',
    metadata: { userId: 'user_1', sessionId: 'session_1' },
  })
  await chunkRepo.create({
    sourceId: memory.sourceId,
    chunkIndex: 1,
    content: 'User dislikes verbose spending projections and asks budget shortcuts',
    metadata: { userId: 'user_2', sessionId: 'session_2' },
  })
  await chunkRepo.create({
    sourceId: world.sourceId,
    chunkIndex: 0,
    content: 'The world includes a strict budget rule for travelers',
  })
  await chunkRepo.create({
    sourceId: media.sourceId,
    chunkIndex: 0,
    content: 'Illustration of travel budget dashboard',
    metadata: { tags: ['travel', 'budget', 'dashboard'] },
  })

  return { sourceRepo, chunkRepo }
}

describe('TypedRetrievalService', () => {
  it('returns separated typed retrieval sections with trace metadata', async () => {
    const { sourceRepo, chunkRepo } = await seed()
    const service = new TypedRetrievalService(sourceRepo, chunkRepo)

    const result = await service.retrieve({
      scenarioId: 'scenario_1',
      sessionId: 'session_1',
      userId: 'user_1',
      query: 'travel budget',
      limitPerType: 2,
    })

    expect(result.memory).toHaveLength(1)
    expect(result.world).toHaveLength(1)
    expect(result.media).toHaveLength(1)

    expect(result.memory[0]?.knowledgeType).toBe('memory')
    expect(result.world[0]?.knowledgeType).toBe('world')
    expect(result.media[0]?.knowledgeType).toBe('media')

    expect(result.trace.perType.memory.sourceIds.length).toBeGreaterThan(0)
    expect(result.trace.perType.media.selectedChunkIds.length).toBe(1)
    expect(result.trace.perType.memory.visibility?.excludedChunkCount).toBe(0)
    expect(result.memory[0]?.reason).toContain('token-overlap')
  })

  it('prevents cross-domain mixing via source type filtering', async () => {
    const { sourceRepo, chunkRepo } = await seed()
    const service = new TypedRetrievalService(sourceRepo, chunkRepo)

    const result = await service.retrieve({
      scenarioId: 'scenario_1',
      query: 'budget',
    })

    const memorySourceIds = new Set(result.memory.map((item) => item.sourceId))
    const worldSourceIds = new Set(result.world.map((item) => item.sourceId))
    const mediaSourceIds = new Set(result.media.map((item) => item.sourceId))

    for (const sourceId of memorySourceIds) {
      expect(worldSourceIds.has(sourceId)).toBe(false)
      expect(mediaSourceIds.has(sourceId)).toBe(false)
    }
  })

  it('hard-filters memory chunks when user/session scope is provided', async () => {
    const { sourceRepo, chunkRepo } = await seed()
    const service = new TypedRetrievalService(sourceRepo, chunkRepo)

    const result = await service.retrieve({
      scenarioId: 'scenario_1',
      query: 'budget',
      userId: 'user_1',
      sessionId: 'session_1',
    })

    expect(result.memory).toHaveLength(1)
    expect(result.memory[0]?.metadata).toMatchObject({ userId: 'user_1', sessionId: 'session_1' })
  })

  it('filters non-visible knowledge by active avatar deterministically', async () => {
    const sourceRepo = new InMemoryKnowledgeSourceRepository()
    const chunkRepo = new InMemoryKnowledgeChunkRepository()

    const world = await sourceRepo.create({
      scenarioId: 'scenario_1',
      name: 'Avatar scoped world',
      knowledgeType: 'world',
      format: 'markdown',
      uriOrPath: '/world.md',
      visibleToAvatarIds: ['avatar_1'],
    })
    await sourceRepo.updateStatus(world.sourceId, 'ready')
    await chunkRepo.create({
      sourceId: world.sourceId,
      chunkIndex: 0,
      content: 'visible only to avatar one',
      visibleToAvatarIds: ['avatar_1'],
    })

    const service = new TypedRetrievalService(sourceRepo, chunkRepo)
    const forAvatarOne = await service.retrieve({
      scenarioId: 'scenario_1',
      query: 'visible',
      activeAvatarId: 'avatar_1',
    })
    const forAvatarTwo = await service.retrieve({
      scenarioId: 'scenario_1',
      query: 'visible',
      activeAvatarId: 'avatar_2',
    })
    const forGm = await service.retrieve({
      scenarioId: 'scenario_1',
      query: 'visible',
      bypassVisibilityFilter: true,
    })

    expect(forAvatarOne.world).toHaveLength(1)
    expect(forAvatarTwo.world).toHaveLength(0)
    expect(forGm.world).toHaveLength(1)
    expect(forAvatarTwo.trace.perType.world.visibility?.activeAvatarId).toBe('avatar_2')
    expect(forAvatarTwo.trace.perType.world.visibility?.excludedChunkCount).toBe(1)
  })
})

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

// eslint-disable-next-line max-lines-per-function
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

  it('keeps authored avatar-private memory available even when session scope is provided', async () => {
    const sourceRepo = new InMemoryKnowledgeSourceRepository()
    const chunkRepo = new InMemoryKnowledgeChunkRepository()

    const memory = await sourceRepo.create({
      scenarioId: 'scenario_1',
      name: 'Avatar private memory',
      knowledgeType: 'memory',
      format: 'markdown',
      uriOrPath: '/avatar-memory.md',
      visibleToAvatarIds: ['avatar_1'],
    })
    await sourceRepo.updateStatus(memory.sourceId, 'ready')
    await chunkRepo.create({
      sourceId: memory.sourceId,
      chunkIndex: 0,
      content: 'Private alibi details for avatar one',
      visibleToAvatarIds: ['avatar_1'],
    })

    const service = new TypedRetrievalService(sourceRepo, chunkRepo)
    const visible = await service.retrieve({
      scenarioId: 'scenario_1',
      query: 'alibi',
      userId: 'user_1',
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      activeAvatarId: 'avatar_1',
    })
    const hidden = await service.retrieve({
      scenarioId: 'scenario_1',
      query: 'alibi',
      userId: 'user_1',
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      activeAvatarId: 'avatar_2',
    })

    expect(visible.memory).toHaveLength(1)
    expect(visible.memory[0]?.chunkId).toBeDefined()
    expect(hidden.memory).toHaveLength(0)
    expect(hidden.trace.perType.memory.visibility?.excludedChunkCount).toBe(1)
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

  it('treats explicit all visibility as public even when stale avatar ids exist', async () => {
    const sourceRepo = new InMemoryKnowledgeSourceRepository([
      {
        sourceId: 'knowledge_source_world',
        scenarioId: 'scenario_1',
        name: 'Shared world',
        knowledgeType: 'world',
        format: 'text',
        uriOrPath: '/world.txt',
        status: 'ready',
        visibilityPolicy: 'all',
        visibleToAvatarIds: ['avatar_hidden'],
        createdAt: '2026-05-11T08:00:00.000Z',
        updatedAt: '2026-05-11T08:00:00.000Z',
      },
    ])
    const chunkRepo = new InMemoryKnowledgeChunkRepository()
    await chunkRepo.create({
      sourceId: 'knowledge_source_world',
      chunkIndex: 0,
      content: 'Shared harbor law',
    })

    const service = new TypedRetrievalService(sourceRepo, chunkRepo)
    const result = await service.retrieve({
      scenarioId: 'scenario_1',
      query: 'harbor law',
      activeAvatarId: 'avatar_2',
    })

    expect(result.world).toHaveLength(1)
    expect(result.trace.perType.world.visibility?.excludedChunkCount).toBe(0)
  })

  it('treats avatars visibility without avatar ids as hidden', async () => {
    const sourceRepo = new InMemoryKnowledgeSourceRepository([
      {
        sourceId: 'knowledge_source_world',
        scenarioId: 'scenario_1',
        name: 'Broken private world',
        knowledgeType: 'world',
        format: 'text',
        uriOrPath: '/world.txt',
        status: 'ready',
        visibilityPolicy: 'avatars',
        createdAt: '2026-05-11T08:00:00.000Z',
        updatedAt: '2026-05-11T08:00:00.000Z',
      },
    ])
    const chunkRepo = new InMemoryKnowledgeChunkRepository()
    await chunkRepo.create({
      sourceId: 'knowledge_source_world',
      chunkIndex: 0,
      content: 'Broken private clue',
    })

    const service = new TypedRetrievalService(sourceRepo, chunkRepo)
    const visible = await service.retrieve({
      scenarioId: 'scenario_1',
      query: 'private clue',
      activeAvatarId: 'avatar_1',
    })
    const gm = await service.retrieve({
      scenarioId: 'scenario_1',
      query: 'private clue',
      bypassVisibilityFilter: true,
    })

    expect(visible.world).toHaveLength(0)
    expect(visible.trace.perType.world.visibility?.excludedChunkCount).toBe(1)
    expect(gm.world).toHaveLength(1)
  })

  it('ranks unique matches across GM, user, and working-memory queries', async () => {
    const sourceRepo = new InMemoryKnowledgeSourceRepository()
    const chunkRepo = new InMemoryKnowledgeChunkRepository()

    const world = await sourceRepo.create({
      scenarioId: 'scenario_1',
      name: 'World source',
      knowledgeType: 'world',
      format: 'markdown',
      uriOrPath: '/world.md',
    })
    await sourceRepo.updateStatus(world.sourceId, 'ready')

    await chunkRepo.create({
      sourceId: world.sourceId,
      chunkIndex: 0,
      content: 'harbor protocol checklist',
    })
    await chunkRepo.create({
      sourceId: world.sourceId,
      chunkIndex: 1,
      content: 'dock before storm tide',
    })
    await chunkRepo.create({
      sourceId: world.sourceId,
      chunkIndex: 2,
      content: 'concise operational guidance chart rope',
    })
    await chunkRepo.create({
      sourceId: world.sourceId,
      chunkIndex: 3,
      content: 'harbor storm rope',
    })

    const service = new TypedRetrievalService(sourceRepo, chunkRepo)
    const result = await service.retrieve({
      scenarioId: 'scenario_1',
      query:
        'Follow harbor protocol. | What should I do before the storm tide? | concise operational guidance rope',
      queries: [
        { source: 'gm_guideline', text: 'Follow harbor protocol.' },
        { source: 'last_user_input', text: 'What should I do before the storm tide?' },
        { source: 'working_memory', text: 'concise operational guidance rope' },
      ],
      limitPerType: 3,
    })

    expect(result.world).toHaveLength(3)
    expect(result.world.map((item) => item.content)).toEqual([
      'concise operational guidance chart rope',
      'harbor protocol checklist',
      'dock before storm tide',
    ])
    expect(result.world[0]?.reason).toContain('working-memory')
    expect(result.world[1]?.reason).toContain('gm-guideline')
    expect(result.world[2]?.reason).toContain('last-user-input')
  })

  it('uses GM queries and required facts to select matching RAG chunks', async () => {
    const sourceRepo = new InMemoryKnowledgeSourceRepository()
    const chunkRepo = new InMemoryKnowledgeChunkRepository()
    const world = await sourceRepo.create({
      scenarioId: 'scenario_1',
      name: 'Scenario world',
      knowledgeType: 'world',
      format: 'markdown',
      uriOrPath: '/scenario.md',
    })
    await sourceRepo.updateStatus(world.sourceId, 'ready')
    await chunkRepo.create({
      sourceId: world.sourceId,
      chunkIndex: 0,
      content: 'Le dernier emplacement confirmé de Mona est la maison de son grand-père.',
    })

    const service = new TypedRetrievalService(sourceRepo, chunkRepo)
    const result = await service.retrieve({
      scenarioId: 'scenario_1',
      query: 'Emplacement actuel de Mona | Dernier emplacement confirmé de Mona',
      queries: [
        { source: 'gm_retrieval_query', text: 'Emplacement actuel de Mona' },
        { source: 'gm_required_fact', text: 'Dernier emplacement confirmé de Mona' },
      ],
    })

    expect(result.world.map((item) => item.content)).toEqual([
      'Le dernier emplacement confirmé de Mona est la maison de son grand-père.',
    ])
    expect(result.world[0]?.reason).toContain('gm-retrieval-query')
  })

  it('keeps one best match for the user, GM queries, and required facts before global fill', async () => {
    const sourceRepo = new InMemoryKnowledgeSourceRepository()
    const chunkRepo = new InMemoryKnowledgeChunkRepository()
    const world = await sourceRepo.create({
      scenarioId: 'scenario_1',
      name: 'Scenario world',
      knowledgeType: 'world',
      format: 'markdown',
      uriOrPath: '/scenario.md',
    })
    await sourceRepo.updateStatus(world.sourceId, 'ready')

    const contents = [
      'user question harbor answer',
      'canonical harbor rule',
      'last confirmed harbor location',
      'user question secondary context',
      'canonical harbor secondary context',
      'required fact secondary context',
      'fallback directive high signal',
      'fallback memory high signal',
    ]
    for (const [chunkIndex, content] of contents.entries()) {
      await chunkRepo.create({ sourceId: world.sourceId, chunkIndex, content })
    }

    const service = new TypedRetrievalService(sourceRepo, chunkRepo)
    const result = await service.retrieve({
      scenarioId: 'scenario_1',
      query: 'user question harbor',
      queries: [
        { source: 'last_user_input', text: 'user question harbor' },
        { source: 'gm_retrieval_query', text: 'canonical harbor rule' },
        { source: 'gm_required_fact', text: 'last confirmed harbor location' },
        { source: 'gm_guideline', text: 'fallback directive high signal' },
        { source: 'working_memory', text: 'fallback memory high signal' },
      ],
      limitPerType: 5,
    })

    expect(result.world).toHaveLength(5)
    expect(result.world.map((item) => item.content)).toEqual([
      'user question harbor answer',
      'canonical harbor rule',
      'last confirmed harbor location',
      'user question secondary context',
      'canonical harbor secondary context',
    ])
    expect(result.world.slice(0, 3).map((item) => item.matchedQuery?.source)).toEqual([
      'last_user_input',
      'gm_retrieval_query',
      'gm_required_fact',
    ])
    expect(result.world[0]?.matchedQuery?.text).toBe('user question harbor')
  })

  it('enforces visibilityPolicy none: blocks all avatar retrieval, passes GM bypass', async () => {
    const sourceRepo = new InMemoryKnowledgeSourceRepository()
    const chunkRepo = new InMemoryKnowledgeChunkRepository()

    const world = await sourceRepo.create({
      scenarioId: 'scenario_1',
      name: 'GM-only world lore',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/gm-only.txt',
      visibilityPolicy: 'none',
    })
    await sourceRepo.updateStatus(world.sourceId, 'ready')
    await chunkRepo.create({
      sourceId: world.sourceId,
      chunkIndex: 0,
      content: 'secret gm-only orchestration hint',
    })

    const service = new TypedRetrievalService(sourceRepo, chunkRepo)

    const avatarResult = await service.retrieve({
      scenarioId: 'scenario_1',
      query: 'secret orchestration',
      activeAvatarId: 'avatar_1',
    })
    const noAvatarResult = await service.retrieve({
      scenarioId: 'scenario_1',
      query: 'secret orchestration',
    })
    const gmResult = await service.retrieve({
      scenarioId: 'scenario_1',
      query: 'secret orchestration',
      bypassVisibilityFilter: true,
    })

    expect(avatarResult.world).toHaveLength(0)
    expect(avatarResult.trace.perType.world.visibility?.excludedChunkCount).toBe(1)
    expect(noAvatarResult.world).toHaveLength(0)
    expect(gmResult.world).toHaveLength(1)
    expect(gmResult.world[0]?.content).toBe('secret gm-only orchestration hint')
  })
})

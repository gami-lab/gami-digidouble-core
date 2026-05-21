import type { Sql } from 'postgres'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { PostgresKnowledgeSourceRepository } from './postgres-knowledge-source.repository.js'
import { PostgresScenarioRepository } from './postgres-scenario.repository.js'

describe.skipIf(!DB_AVAILABLE)('PostgresKnowledgeSourceRepository', () => {
  let sql: Sql
  let scenarioRepo: PostgresScenarioRepository
  let sourceRepo: PostgresKnowledgeSourceRepository
  let scenarioId: string

  beforeAll(async () => {
    sql = createTestSql()
    scenarioRepo = new PostgresScenarioRepository(sql)
    sourceRepo = new PostgresKnowledgeSourceRepository(sql)
    const scenario = await scenarioRepo.create({ name: 'Knowledge scenario', status: 'active' })
    scenarioId = scenario.scenarioId
  })

  afterEach(async () => {
    await truncateAllTables(sql)
    const scenario = await scenarioRepo.create({ name: 'Knowledge scenario', status: 'active' })
    scenarioId = scenario.scenarioId
  })

  afterAll(async () => {
    await sql.end()
  })

  it('creates and fetches a source by id', async () => {
    const created = await sourceRepo.create({
      scenarioId,
      name: 'World Lore',
      knowledgeType: 'world',
      format: 'markdown',
      uriOrPath: '/data/world.md',
      metadata: { version: 1 },
    })

    const found = await sourceRepo.findById(created.sourceId)

    expect(found).toMatchObject({
      sourceId: created.sourceId,
      scenarioId,
      knowledgeType: 'world',
      format: 'markdown',
      status: 'pending',
    })
    expect(found?.metadata).toEqual({ version: 1 })
    expect(found?.visibleToAvatarIds).toBeUndefined()
  })

  it('persists explicit visibleToAvatarIds and keeps empty list as default visibility', async () => {
    const visible = await sourceRepo.create({
      scenarioId,
      name: 'Private source',
      knowledgeType: 'memory',
      format: 'text',
      uriOrPath: '/data/private.txt',
      visibleToAvatarIds: ['avatar_a', 'avatar_b'],
    })
    const publicByEmpty = await sourceRepo.create({
      scenarioId,
      name: 'Public source',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/data/public.txt',
      visibleToAvatarIds: [],
    })

    const visibleFound = await sourceRepo.findById(visible.sourceId)
    const publicFound = await sourceRepo.findById(publicByEmpty.sourceId)

    expect(visibleFound?.visibleToAvatarIds).toEqual(['avatar_a', 'avatar_b'])
    expect(publicFound?.visibleToAvatarIds).toBeUndefined()
  })

  it('lists by scenario with filters', async () => {
    await sourceRepo.create({
      scenarioId,
      name: 'World',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/world.txt',
    })
    const media = await sourceRepo.create({
      scenarioId,
      name: 'Media',
      knowledgeType: 'media',
      format: 'url',
      uriOrPath: 'https://example.com/a.png',
    })
    await sourceRepo.updateStatus(media.sourceId, 'ready')

    const world = await sourceRepo.listByScenario({ scenarioId, knowledgeType: 'world' })
    const ready = await sourceRepo.listByScenario({ scenarioId, status: 'ready' })

    expect(world).toHaveLength(1)
    expect(world[0]?.knowledgeType).toBe('world')
    expect(ready).toHaveLength(1)
    expect(ready[0]?.sourceId).toBe(media.sourceId)
  })

  it('updateStatus returns null for unknown source ids', async () => {
    await expect(sourceRepo.updateStatus('knowledge_source_missing', 'ready')).resolves.toBeNull()
  })
})

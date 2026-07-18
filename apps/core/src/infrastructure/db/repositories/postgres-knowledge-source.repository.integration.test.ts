import type { Sql } from 'postgres'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  DB_AVAILABLE,
  createTestSql,
  ensureSchemaAlignment,
  truncateAllTables,
} from '../test-helpers.js'
import { PostgresKnowledgeSourceRepository } from './postgres-knowledge-source.repository.js'
import { PostgresScenarioRepository } from './postgres-scenario.repository.js'

type RepositoryTestState = {
  sql: Sql
  scenarioRepo: PostgresScenarioRepository
  sourceRepo: PostgresKnowledgeSourceRepository
  scenarioId: string
}

function registerRepositoryLifecycle(state: RepositoryTestState): void {
  beforeAll(async () => {
    state.sql = createTestSql()
    await ensureSchemaAlignment(state.sql)
    state.scenarioRepo = new PostgresScenarioRepository(state.sql)
    state.sourceRepo = new PostgresKnowledgeSourceRepository(state.sql)
    const scenario = await state.scenarioRepo.create({
      name: 'Knowledge scenario',
      status: 'active',
    })
    state.scenarioId = scenario.scenarioId
  })

  afterEach(async () => {
    await truncateAllTables(state.sql)
    const scenario = await state.scenarioRepo.create({
      name: 'Knowledge scenario',
      status: 'active',
    })
    state.scenarioId = scenario.scenarioId
  })

  afterAll(async () => {
    await state.sql.end()
  })
}

describe.skipIf(!DB_AVAILABLE)('PostgresKnowledgeSourceRepository — create/find', () => {
  let sql: Sql
  let scenarioRepo: PostgresScenarioRepository
  let sourceRepo: PostgresKnowledgeSourceRepository
  let scenarioId: string

  registerRepositoryLifecycle({
    get sql() {
      return sql
    },
    set sql(value) {
      sql = value
    },
    get scenarioRepo() {
      return scenarioRepo
    },
    set scenarioRepo(value) {
      scenarioRepo = value
    },
    get sourceRepo() {
      return sourceRepo
    },
    set sourceRepo(value) {
      sourceRepo = value
    },
    get scenarioId() {
      return scenarioId
    },
    set scenarioId(value) {
      scenarioId = value
    },
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

  it('normalizes visibilityPolicy and avatar ids coherently on create', async () => {
    const publicSource = await sourceRepo.create({
      scenarioId,
      name: 'Shared source',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/data/shared.txt',
      visibilityPolicy: 'all',
      visibleToAvatarIds: ['avatar_hidden'],
    })
    const privateSource = await sourceRepo.create({
      scenarioId,
      name: 'Private source',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/data/private.txt',
      visibleToAvatarIds: ['avatar_a'],
    })

    const publicFound = await sourceRepo.findById(publicSource.sourceId)
    const privateFound = await sourceRepo.findById(privateSource.sourceId)

    expect(publicFound?.visibilityPolicy).toBe('all')
    expect(publicFound?.visibleToAvatarIds).toBeUndefined()
    expect(privateFound?.visibilityPolicy).toBe('avatars')
    expect(privateFound?.visibleToAvatarIds).toEqual(['avatar_a'])
  })
})

describe.skipIf(!DB_AVAILABLE)('PostgresKnowledgeSourceRepository — list/status', () => {
  let sql: Sql
  let scenarioRepo: PostgresScenarioRepository
  let sourceRepo: PostgresKnowledgeSourceRepository
  let scenarioId: string

  registerRepositoryLifecycle({
    get sql() {
      return sql
    },
    set sql(value) {
      sql = value
    },
    get scenarioRepo() {
      return scenarioRepo
    },
    set scenarioRepo(value) {
      scenarioRepo = value
    },
    get sourceRepo() {
      return sourceRepo
    },
    set sourceRepo(value) {
      sourceRepo = value
    },
    get scenarioId() {
      return scenarioId
    },
    set scenarioId(value) {
      scenarioId = value
    },
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

describe.skipIf(!DB_AVAILABLE)('PostgresKnowledgeSourceRepository — update/delete', () => {
  let sql: Sql
  let scenarioRepo: PostgresScenarioRepository
  let sourceRepo: PostgresKnowledgeSourceRepository
  let scenarioId: string

  beforeAll(async () => {
    sql = createTestSql()
    await ensureSchemaAlignment(sql)
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

  it('update() applies only the provided fields and refreshes updatedAt', async () => {
    const created = await sourceRepo.create({
      scenarioId,
      name: 'World Lore',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/data/world.txt',
    })

    const updated = await sourceRepo.update(created.sourceId, { name: 'Updated Lore' })

    expect(updated?.name).toBe('Updated Lore')
    expect(updated?.uriOrPath).toBe('/data/world.txt')
    expect(updated?.updatedAt).toBeTypeOf('string')
  })

  it('update() resets status to pending and replaces metadata/uriOrPath', async () => {
    const created = await sourceRepo.create({
      scenarioId,
      name: 'World Lore',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/data/world.txt',
    })
    await sourceRepo.updateStatus(created.sourceId, 'ready')

    const updated = await sourceRepo.update(created.sourceId, {
      metadata: { inlineText: 'New content' },
      uriOrPath: '/data/world-v2.txt',
      status: 'pending',
    })

    expect(updated?.status).toBe('pending')
    expect(updated?.metadata).toEqual({ inlineText: 'New content' })
    expect(updated?.uriOrPath).toBe('/data/world-v2.txt')
  })

  it('update() clears visibleToAvatarIds when given an empty array', async () => {
    const created = await sourceRepo.create({
      scenarioId,
      name: 'Private source',
      knowledgeType: 'memory',
      format: 'text',
      uriOrPath: '/data/private.txt',
      visibleToAvatarIds: ['avatar_a'],
    })

    const updated = await sourceRepo.update(created.sourceId, { visibleToAvatarIds: [] })

    expect(updated?.visibleToAvatarIds).toBeUndefined()
  })

  it('update() returns null for unknown source ids', async () => {
    await expect(
      sourceRepo.update('knowledge_source_missing', { name: 'New Name' }),
    ).resolves.toBeNull()
  })

  it('delete() removes the source', async () => {
    const created = await sourceRepo.create({
      scenarioId,
      name: 'World Lore',
      knowledgeType: 'world',
      format: 'text',
      uriOrPath: '/data/world.txt',
    })

    await sourceRepo.delete(created.sourceId)

    await expect(sourceRepo.findById(created.sourceId)).resolves.toBeNull()
  })

  it('delete() is a no-op for unknown source ids', async () => {
    await expect(sourceRepo.delete('knowledge_source_missing')).resolves.toBeUndefined()
  })
})

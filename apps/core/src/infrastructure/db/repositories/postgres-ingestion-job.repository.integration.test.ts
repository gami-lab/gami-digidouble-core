import type { Sql } from 'postgres'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { PostgresIngestionJobRepository } from './postgres-ingestion-job.repository.js'
import { PostgresKnowledgeSourceRepository } from './postgres-knowledge-source.repository.js'
import { PostgresScenarioRepository } from './postgres-scenario.repository.js'

describe.skipIf(!DB_AVAILABLE)('PostgresIngestionJobRepository', () => {
  let sql: Sql
  let scenarioRepo: PostgresScenarioRepository
  let sourceRepo: PostgresKnowledgeSourceRepository
  let jobRepo: PostgresIngestionJobRepository
  let sourceId: string

  beforeAll(() => {
    sql = createTestSql()
    scenarioRepo = new PostgresScenarioRepository(sql)
    sourceRepo = new PostgresKnowledgeSourceRepository(sql)
    jobRepo = new PostgresIngestionJobRepository(sql)
  })

  afterEach(async () => {
    await truncateAllTables(sql)
  })

  afterAll(async () => {
    await sql.end()
  })

  async function seedSource(): Promise<void> {
    const scenario = await scenarioRepo.create({ name: 'Ingestion scenario', status: 'active' })
    const source = await sourceRepo.create({
      scenarioId: scenario.scenarioId,
      name: 'Ingestion source',
      knowledgeType: 'memory',
      format: 'text',
      uriOrPath: '/tmp/source.txt',
    })
    sourceId = source.sourceId
  }

  it('creates and finds ingestion jobs', async () => {
    await seedSource()

    const created = await jobRepo.create({ sourceId, status: 'queued' })
    const found = await jobRepo.findById(created.ingestionJobId)

    expect(found).toMatchObject({
      ingestionJobId: created.ingestionJobId,
      sourceId,
      status: 'queued',
      attempts: 0,
    })
  })

  it('updates status and attempts', async () => {
    await seedSource()

    const created = await jobRepo.create({ sourceId, status: 'queued' })
    const updated = await jobRepo.updateStatus(created.ingestionJobId, {
      status: 'running',
      attempts: 1,
      startedAt: '2026-05-11T10:00:00.000Z',
    })

    expect(updated?.status).toBe('running')
    expect(updated?.attempts).toBe(1)
    expect(updated?.startedAt).toBe('2026-05-11T10:00:00.000Z')
  })

  it('lists source jobs newest first', async () => {
    await seedSource()

    await jobRepo.create({ sourceId, status: 'queued' })
    await jobRepo.create({ sourceId, status: 'running' })

    const jobs = await jobRepo.listBySourceId(sourceId)

    expect(jobs).toHaveLength(2)
    expect(jobs[0]?.status).toBe('running')
    expect(jobs[1]?.status).toBe('queued')
  })
})

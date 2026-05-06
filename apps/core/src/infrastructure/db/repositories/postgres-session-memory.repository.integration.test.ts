import type { Sql } from 'postgres'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { PostgresScenarioRepository } from './postgres-scenario.repository.js'
import { PostgresSessionRepository } from './postgres-session.repository.js'
import { PostgresSessionMemoryRepository } from './postgres-session-memory.repository.js'

describe.skipIf(!DB_AVAILABLE)('PostgresSessionMemoryRepository', () => {
  let sql!: Sql
  let scenarioRepo!: PostgresScenarioRepository
  let sessionRepo!: PostgresSessionRepository
  let repository!: PostgresSessionMemoryRepository
  let sessionId = ''

  beforeAll(() => {
    sql = createTestSql()
    scenarioRepo = new PostgresScenarioRepository(sql)
    sessionRepo = new PostgresSessionRepository(sql)
    repository = new PostgresSessionMemoryRepository(sql)
  })

  afterEach(async () => {
    await truncateAllTables(sql)
    const scenario = await scenarioRepo.create({ name: 'Session memory harness' })
    const session = await sessionRepo.create({ userId: 'user_1', scenarioId: scenario.scenarioId })
    sessionId = session.sessionId
  })

  afterAll(async () => {
    await truncateAllTables(sql)
    await sql.end()
  })

  it('findBySessionId returns null when row does not exist', async () => {
    await expect(repository.findBySessionId('session_missing')).resolves.toBeNull()
  })

  it('upsert inserts and then updates the same row', async () => {
    const created = await repository.upsert({
      sessionId,
      summary: 'First summary',
    })

    const updated = await repository.upsert({
      sessionId,
      summary: 'Updated summary',
    })

    expect(updated.sessionId).toBe(sessionId)
    expect(updated.summary).toBe('Updated summary')
    expect(Date.parse(updated.updatedAt)).toBeGreaterThanOrEqual(Date.parse(created.updatedAt))

    const rows = await sql<
      Array<{ count: string }>
    >`SELECT COUNT(*)::TEXT AS count FROM session_memories`
    expect(Number(rows[0]?.count ?? '0')).toBe(1)
  })

  it('deleteBySessionId removes only targeted session row', async () => {
    const scenario = await scenarioRepo.create({ name: 'Second session scenario' })
    const second = await sessionRepo.create({ userId: 'user_2', scenarioId: scenario.scenarioId })

    await repository.upsert({ sessionId, summary: 'S1 summary' })
    await repository.upsert({ sessionId: second.sessionId, summary: 'S2 summary' })

    await expect(repository.deleteBySessionId(sessionId)).resolves.toBe(true)
    await expect(repository.findBySessionId(sessionId)).resolves.toBeNull()
    await expect(repository.findBySessionId(second.sessionId)).resolves.toMatchObject({
      summary: 'S2 summary',
    })
  })
})

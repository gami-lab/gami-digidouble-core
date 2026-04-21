import type { Sql } from 'postgres'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { PostgresScenarioRepository } from './postgres-scenario.repository.js'
import { PostgresSessionRepository } from './postgres-session.repository.js'

describe.skipIf(!DB_AVAILABLE)('PostgresSessionRepository', () => {
  let sql: Sql
  let scenarioRepo: PostgresScenarioRepository
  let sessionRepo: PostgresSessionRepository
  let scenarioId: string

  beforeAll(async () => {
    sql = await createTestSql()
    scenarioRepo = new PostgresScenarioRepository(sql)
    sessionRepo = new PostgresSessionRepository(sql)
    const scenario = await scenarioRepo.create({
      name: 'Harness',
    })
    scenarioId = scenario.scenarioId
  })

  afterEach(async () => {
    await sql`TRUNCATE sessions CASCADE`
  })

  afterAll(async () => {
    await truncateAllTables(sql)
    await sql.end()
  })

  it('creates a session and returns it with generated id and timestamps', async () => {
    const session = await sessionRepo.create({ userId: 'user-1', scenarioId })

    expect(session.sessionId).toBeTypeOf('string')
    expect(session.userId).toBe('user-1')
    expect(session.scenarioId).toBe(scenarioId)
    expect(session.status).toBe('active')
    expect(session.startedAt).toBeTypeOf('string')
    expect(session.lastActivityAt).toBeTypeOf('string')
    expect(session.endedAt).toBeUndefined()
  })

  it('findById returns the session by its id', async () => {
    const created = await sessionRepo.create({ userId: 'user-2', scenarioId })
    const found = await sessionRepo.findById(created.sessionId)

    expect(found).not.toBeNull()
    expect(found?.sessionId).toBe(created.sessionId)
  })

  it('findById returns null for a non-existent id', async () => {
    const result = await sessionRepo.findById('00000000-0000-0000-0000-000000000000')
    expect(result).toBeNull()
  })

  it('update changes status and returns the updated session', async () => {
    const created = await sessionRepo.create({ userId: 'user-3', scenarioId })
    const updated = await sessionRepo.update(created.sessionId, { status: 'closed' })

    expect(updated.status).toBe('closed')
    expect(updated.sessionId).toBe(created.sessionId)
  })

  it('update sets endedAt when provided', async () => {
    const created = await sessionRepo.create({ userId: 'user-4', scenarioId })
    const endedAt = new Date().toISOString()
    const updated = await sessionRepo.update(created.sessionId, { status: 'closed', endedAt })

    expect(updated.endedAt).toBeTypeOf('string')
  })

  it('update preserves untouched columns', async () => {
    const created = await sessionRepo.create({ userId: 'user-5', scenarioId })
    const updated = await sessionRepo.update(created.sessionId, { status: 'archived' })

    expect(updated.userId).toBe(created.userId)
    expect(updated.scenarioId).toBe(created.scenarioId)
    expect(updated.startedAt).toBe(created.startedAt)
    expect(updated.status).toBe('archived')
  })

  it('update throws when session does not exist', async () => {
    await expect(
      sessionRepo.update('00000000-0000-0000-0000-000000000000', { status: 'closed' }),
    ).rejects.toThrow('Session 00000000-0000-0000-0000-000000000000 was not found.')
  })

  it('delete removes the session', async () => {
    const created = await sessionRepo.create({ userId: 'user-6', scenarioId })
    await sessionRepo.delete(created.sessionId)
    const found = await sessionRepo.findById(created.sessionId)

    expect(found).toBeNull()
  })

  it('countByScenarioId returns all sessions linked to the scenario', async () => {
    await sessionRepo.create({ userId: 'user-7', scenarioId })
    await sessionRepo.create({ userId: 'user-8', scenarioId })

    const count = await sessionRepo.countByScenarioId(scenarioId)

    expect(count).toBe(2)
  })

  it('countActiveByScenarioId returns only active sessions', async () => {
    const active = await sessionRepo.create({ userId: 'user-9', scenarioId })
    const closed = await sessionRepo.create({ userId: 'user-10', scenarioId })
    await sessionRepo.update(closed.sessionId, { status: 'closed' })

    const count = await sessionRepo.countActiveByScenarioId(scenarioId)

    expect(count).toBe(1)
    expect(active.sessionId).toContain('session_')
  })
})

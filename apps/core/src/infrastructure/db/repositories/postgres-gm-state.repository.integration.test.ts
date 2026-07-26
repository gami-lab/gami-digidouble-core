import type { Sql } from 'postgres'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { GameMasterState } from '../../../domain/game-master/game-master.types.js'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { PostgresScenarioRepository } from './postgres-scenario.repository.js'
import { PostgresSessionRepository } from './postgres-session.repository.js'
import { PostgresGmStateRepository } from './postgres-gm-state.repository.js'

describe.skipIf(!DB_AVAILABLE)('PostgresGmStateRepository', () => {
  let sql: Sql
  let scenarioRepo: PostgresScenarioRepository
  let sessionRepo: PostgresSessionRepository
  let gmStateRepo: PostgresGmStateRepository
  let sessionId: string

  beforeAll(() => {
    sql = createTestSql()
    scenarioRepo = new PostgresScenarioRepository(sql)
    sessionRepo = new PostgresSessionRepository(sql)
    gmStateRepo = new PostgresGmStateRepository(sql)
  })

  afterEach(async () => {
    await truncateAllTables(sql)
    const scenario = await scenarioRepo.create({ name: 'GM State Harness' })
    const session = await sessionRepo.create({ userId: 'user-1', scenarioId: scenario.scenarioId })
    sessionId = session.sessionId
  })

  afterAll(async () => {
    await truncateAllTables(sql)
    await sql.end()
  })

  it('findBySessionId returns null when no state exists for the session', async () => {
    const scenario = await scenarioRepo.create({ name: 'Empty Harness' })
    const session = await sessionRepo.create({
      userId: 'user-none',
      scenarioId: scenario.scenarioId,
    })

    const result = await gmStateRepo.findBySessionId(session.sessionId)

    expect(result).toBeNull()
  })

  it('save inserts a new state row and findBySessionId returns it', async () => {
    const state: GameMasterState = {
      progression: 'intro',
      interactionCount: 3,
    }

    await gmStateRepo.save(sessionId, state)

    const found = await gmStateRepo.findBySessionId(sessionId)
    expect(found).not.toBeNull()
    expect(found?.progression).toBe('intro')
    expect(found?.interactionCount).toBe(3)
  })

  it('second save with same sessionId upserts (updates in place)', async () => {
    const initial: GameMasterState = {
      progression: 'intro',
      interactionCount: 1,
    }
    await gmStateRepo.save(sessionId, initial)

    const updated: GameMasterState = {
      progression: 'advanced',
      interactionCount: 5,
    }
    await gmStateRepo.save(sessionId, updated)

    const found = await gmStateRepo.findBySessionId(sessionId)
    expect(found).not.toBeNull()
    expect(found?.progression).toBe('advanced')
    expect(found?.interactionCount).toBe(5)

    const rows = await sql`SELECT COUNT(*) AS count FROM gm_states`
    expect(Number(rows[0]?.['count'])).toBe(1)
  })

  it('orchestration and interaction fields round-trip correctly through the DB', async () => {
    const state: GameMasterState = {
      progression: 'advanced [marker]',
      interactionCount: 42,
    }

    await gmStateRepo.save(sessionId, state)

    const found = await gmStateRepo.findBySessionId(sessionId)
    expect(found).not.toBeNull()
    expect(found?.progression).toBe('advanced [marker]')
    expect(found?.interactionCount).toBe(42)
  })

  it('ignores legacy current-avatar and covered-topic columns when reading', async () => {
    const state: GameMasterState = {
      progression: 'none',
      interactionCount: 0,
    }

    await gmStateRepo.save(sessionId, state)

    const found = await gmStateRepo.findBySessionId(sessionId)
    expect(found).not.toBeNull()
    expect(found).not.toHaveProperty('currentAvatarId')
    expect(found).not.toHaveProperty('topicsCovered')
  })
})

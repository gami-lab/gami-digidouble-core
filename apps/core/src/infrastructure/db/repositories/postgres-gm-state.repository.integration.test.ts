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
      topicsCovered: ['plastic', 'water'],
      interactionCount: 3,
    }

    await gmStateRepo.save(sessionId, state)

    const found = await gmStateRepo.findBySessionId(sessionId)
    expect(found).not.toBeNull()
    expect(found?.progression).toBe('intro')
    expect(found?.topicsCovered).toEqual(['plastic', 'water'])
    expect(found?.interactionCount).toBe(3)
    expect(found?.currentAvatarId).toBeUndefined()
  })

  it('second save with same sessionId upserts (updates in place)', async () => {
    const initial: GameMasterState = {
      progression: 'intro',
      topicsCovered: ['plastic'],
      interactionCount: 1,
    }
    await gmStateRepo.save(sessionId, initial)

    const updated: GameMasterState = {
      progression: 'advanced',
      topicsCovered: ['plastic', 'ocean'],
      interactionCount: 5,
    }
    await gmStateRepo.save(sessionId, updated)

    const found = await gmStateRepo.findBySessionId(sessionId)
    expect(found).not.toBeNull()
    expect(found?.progression).toBe('advanced')
    expect(found?.topicsCovered).toEqual(['plastic', 'ocean'])
    expect(found?.interactionCount).toBe(5)

    const rows = await sql`SELECT COUNT(*) AS count FROM gm_states`
    expect(Number(rows[0]?.['count'])).toBe(1)
  })

  it('all GameMasterState fields round-trip correctly through the DB', async () => {
    const state: GameMasterState = {
      currentAvatarId: 'avatar_some-uuid',
      progression: 'advanced [marker]',
      topicsCovered: ['topic-a', 'topic-b', 'topic-c'],
      interactionCount: 42,
    }

    await gmStateRepo.save(sessionId, state)

    const found = await gmStateRepo.findBySessionId(sessionId)
    expect(found).not.toBeNull()
    expect(found?.currentAvatarId).toBe('avatar_some-uuid')
    expect(found?.progression).toBe('advanced [marker]')
    expect(found?.topicsCovered).toEqual(['topic-a', 'topic-b', 'topic-c'])
    expect(found?.interactionCount).toBe(42)
  })

  it('currentAvatarId is undefined (not null) when absent', async () => {
    const state: GameMasterState = {
      progression: 'none',
      topicsCovered: [],
      interactionCount: 0,
    }

    await gmStateRepo.save(sessionId, state)

    const found = await gmStateRepo.findBySessionId(sessionId)
    expect(found).not.toBeNull()
    expect(found?.currentAvatarId).toBeUndefined()
  })
})

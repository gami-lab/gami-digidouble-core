import type { Sql } from 'postgres'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { PostgresAvatarRepository } from './postgres-avatar.repository.js'
import { PostgresScenarioRepository } from './postgres-scenario.repository.js'
import { PostgresSessionRepository } from './postgres-session.repository.js'
import { PostgresAvatarSessionMemoryRepository } from './postgres-avatar-session-memory.repository.js'

describe.skipIf(!DB_AVAILABLE)('PostgresAvatarSessionMemoryRepository', () => {
  let sql!: Sql
  let scenarioRepo!: PostgresScenarioRepository
  let sessionRepo!: PostgresSessionRepository
  let avatarRepo!: PostgresAvatarRepository
  let repository!: PostgresAvatarSessionMemoryRepository
  let sessionId = ''
  let avatar1Id = ''
  let avatar2Id = ''

  beforeAll(() => {
    sql = createTestSql()
    scenarioRepo = new PostgresScenarioRepository(sql)
    sessionRepo = new PostgresSessionRepository(sql)
    avatarRepo = new PostgresAvatarRepository(sql)
    repository = new PostgresAvatarSessionMemoryRepository(sql)
  })

  afterEach(async () => {
    await truncateAllTables(sql)
    const scenario = await scenarioRepo.create({ name: 'Avatar memory harness' })
    const session = await sessionRepo.create({ userId: 'user_1', scenarioId: scenario.scenarioId })
    const avatar1 = await avatarRepo.create({
      scenarioId: scenario.scenarioId,
      name: 'Avatar one',
      personaPrompt: 'One',
    })
    const avatar2 = await avatarRepo.create({
      scenarioId: scenario.scenarioId,
      name: 'Avatar two',
      personaPrompt: 'Two',
    })

    sessionId = session.sessionId
    avatar1Id = avatar1.avatarId
    avatar2Id = avatar2.avatarId
  })

  afterAll(async () => {
    await truncateAllTables(sql)
    await sql.end()
  })

  it('findBySessionIdAndAvatarId returns null when row does not exist', async () => {
    await expect(
      repository.findBySessionIdAndAvatarId('session_missing', 'avatar_missing'),
    ).resolves.toBeNull()
  })

  it('upsert inserts and updates per (sessionId, avatarId)', async () => {
    const created = await repository.upsert({
      sessionId,
      avatarId: avatar1Id,
      summary: 'Avatar summary one',
    })

    const updated = await repository.upsert({
      sessionId,
      avatarId: avatar1Id,
      summary: 'Avatar summary one updated',
    })

    expect(updated.avatarId).toBe(avatar1Id)
    expect(updated.summary).toBe('Avatar summary one updated')
    expect(Date.parse(updated.updatedAt)).toBeGreaterThanOrEqual(Date.parse(created.updatedAt))

    const rows = await sql<
      Array<{ count: string }>
    >`SELECT COUNT(*)::TEXT AS count FROM avatar_session_memories`
    expect(Number(rows[0]?.count ?? '0')).toBe(1)
  })

  it('isolates rows by avatar within one session', async () => {
    await repository.upsert({ sessionId, avatarId: avatar1Id, summary: 'A1 summary' })
    await repository.upsert({ sessionId, avatarId: avatar2Id, summary: 'A2 summary' })

    await expect(
      repository.findBySessionIdAndAvatarId(sessionId, avatar1Id),
    ).resolves.toMatchObject({
      summary: 'A1 summary',
    })
    await expect(
      repository.findBySessionIdAndAvatarId(sessionId, avatar2Id),
    ).resolves.toMatchObject({
      summary: 'A2 summary',
    })
  })

  it('deleteBySessionId clears all avatar rows for the session', async () => {
    await repository.upsert({ sessionId, avatarId: avatar1Id, summary: 'A1 summary' })
    await repository.upsert({ sessionId, avatarId: avatar2Id, summary: 'A2 summary' })

    await expect(repository.deleteBySessionId(sessionId)).resolves.toBe(2)
    await expect(repository.findBySessionIdAndAvatarId(sessionId, avatar1Id)).resolves.toBeNull()
    await expect(repository.findBySessionIdAndAvatarId(sessionId, avatar2Id)).resolves.toBeNull()
  })
})

import type { Sql } from 'postgres'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { PostgresAvatarRepository } from './postgres-avatar.repository.js'
import { PostgresConversationRepository } from './postgres-conversation.repository.js'
import { PostgresScenarioRepository } from './postgres-scenario.repository.js'
import { PostgresSessionRepository } from './postgres-session.repository.js'

describe.skipIf(!DB_AVAILABLE)('PostgresConversationRepository', () => {
  let sql: Sql
  let scenarioId: string
  let avatarId: string
  let sessionId: string
  let repository: PostgresConversationRepository

  beforeAll(async () => {
    sql = createTestSql()
    const scenarioRepo = new PostgresScenarioRepository(sql)
    const avatarRepo = new PostgresAvatarRepository(sql)
    const sessionRepo = new PostgresSessionRepository(sql)
    repository = new PostgresConversationRepository(sql)

    const scenario = await scenarioRepo.create({ name: 'Conversation Harness' })
    scenarioId = scenario.scenarioId
    const avatar = await avatarRepo.create({
      scenarioId: scenario.scenarioId,
      name: 'Harness Avatar',
      personaPrompt: 'You are a harness avatar.',
      status: 'active',
    })
    avatarId = avatar.avatarId
    const session = await sessionRepo.create({ userId: 'user-1', scenarioId: scenario.scenarioId })
    sessionId = session.sessionId
  })

  afterEach(async () => {
    await sql`TRUNCATE messages, conversations, sessions CASCADE`
    const sessionRepo = new PostgresSessionRepository(sql)
    const session = await sessionRepo.create({ userId: 'user-1', scenarioId })
    sessionId = session.sessionId
  })

  afterAll(async () => {
    await truncateAllTables(sql)
    await sql.end()
  })

  it('creates and finds a conversation', async () => {
    const created = await repository.create({ sessionId, avatarId, startedBy: 'user' })

    const found = await repository.findById(created.conversationId)

    expect(found).not.toBeNull()
    expect(found?.avatarId).toBe(avatarId)
    expect(found?.sessionId).toBe(sessionId)
  })

  it('lists conversations by session in startedAt order', async () => {
    const first = await repository.create({ sessionId, avatarId, startedBy: 'user' })
    const second = await repository.create({ sessionId, avatarId, startedBy: 'user' })

    const list = await repository.listBySessionId(sessionId)

    expect(list.map((item) => item.conversationId)).toEqual([
      first.conversationId,
      second.conversationId,
    ])
  })

  it('findActiveBySessionId returns the most recently started active conversation', async () => {
    const first = await repository.create({ sessionId, avatarId, startedBy: 'user' })
    const second = await repository.create({ sessionId, avatarId, startedBy: 'user' })
    await repository.update(first.conversationId, {
      status: 'closed',
      endedAt: new Date().toISOString(),
    })

    const active = await repository.findActiveBySessionId(sessionId)

    expect(active?.conversationId).toBe(second.conversationId)
    expect(active?.status).toBe('active')
  })
})

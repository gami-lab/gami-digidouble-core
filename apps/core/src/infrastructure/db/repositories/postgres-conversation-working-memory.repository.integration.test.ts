import type { Sql } from 'postgres'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { PostgresAvatarRepository } from './postgres-avatar.repository.js'
import { PostgresConversationRepository } from './postgres-conversation.repository.js'
import { PostgresConversationWorkingMemoryRepository } from './postgres-conversation-working-memory.repository.js'
import { PostgresScenarioRepository } from './postgres-scenario.repository.js'
import { PostgresSessionRepository } from './postgres-session.repository.js'

describe.skipIf(!DB_AVAILABLE)('PostgresConversationWorkingMemoryRepository', () => {
  let sql!: Sql
  let scenarioId = ''
  let sessionId = ''
  let avatarId = ''
  let conversationId = ''
  let repository!: PostgresConversationWorkingMemoryRepository
  let scenarioRepo!: PostgresScenarioRepository
  let sessionRepo!: PostgresSessionRepository
  let avatarRepo!: PostgresAvatarRepository
  let conversationRepo!: PostgresConversationRepository

  beforeAll(() => {
    sql = createTestSql()
    repository = new PostgresConversationWorkingMemoryRepository(sql)
    scenarioRepo = new PostgresScenarioRepository(sql)
    sessionRepo = new PostgresSessionRepository(sql)
    avatarRepo = new PostgresAvatarRepository(sql)
    conversationRepo = new PostgresConversationRepository(sql)
  })

  afterEach(async () => {
    await truncateAllTables(sql)
    const scenario = await scenarioRepo.create({
      name: 'Conversation WM harness',
      status: 'active',
    })
    scenarioId = scenario.scenarioId
    const avatar = await avatarRepo.create({
      scenarioId,
      name: 'Guide',
      personaPrompt: 'You are a guide.',
      status: 'active',
    })
    avatarId = avatar.avatarId
    const session = await sessionRepo.create({ userId: 'user_1', scenarioId })
    sessionId = session.sessionId
    const conversation = await conversationRepo.create({ sessionId, avatarId, startedBy: 'user' })
    conversationId = conversation.conversationId
  })

  afterAll(async () => {
    await truncateAllTables(sql)
    await sql.end()
  })

  it('findByConversationId returns null when row does not exist', async () => {
    await expect(repository.findByConversationId('conversation_missing')).resolves.toBeNull()
  })

  it('upsert inserts and then updates a single row', async () => {
    const created = await repository.upsert({
      conversationId,
      sessionId,
      avatarId,
      summary: 'First summary',
      unresolvedThreads: ['Need pricing clarity'],
      candidateFacts: [
        { category: 'conversation_signal', key: 'thread_1', value: 'Need pricing clarity' },
      ],
    })

    const updated = await repository.upsert({
      conversationId,
      sessionId,
      avatarId,
      summary: 'Rewritten summary',
      unresolvedThreads: ['Need technical fit details'],
      candidateFacts: [
        { category: 'conversation_signal', key: 'thread_1', value: 'Need technical fit details' },
      ],
    })

    expect(updated.conversationId).toBe(created.conversationId)
    expect(updated.summary).toBe('Rewritten summary')
    expect(updated.unresolvedThreads).toEqual(['Need technical fit details'])
    expect(Date.parse(updated.updatedAt)).toBeGreaterThanOrEqual(Date.parse(created.updatedAt))
  })
})

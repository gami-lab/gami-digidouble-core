import type { Sql } from 'postgres'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { PostgresAvatarRepository } from './postgres-avatar.repository.js'
import { PostgresConversationMemoryRepository } from './postgres-conversation-memory.repository.js'
import { PostgresConversationRepository } from './postgres-conversation.repository.js'
import { PostgresScenarioRepository } from './postgres-scenario.repository.js'
import { PostgresSessionRepository } from './postgres-session.repository.js'

describe.skipIf(!DB_AVAILABLE)('PostgresConversationMemoryRepository', () => {
  let sql!: Sql
  let repository!: PostgresConversationMemoryRepository
  let scenarioRepo!: PostgresScenarioRepository
  let sessionRepo!: PostgresSessionRepository
  let avatarRepo!: PostgresAvatarRepository
  let conversationRepo!: PostgresConversationRepository
  let scenarioId = ''
  let sessionId = ''
  let avatarId = ''
  let conversationId = ''

  beforeAll(() => {
    sql = createTestSql()
    repository = new PostgresConversationMemoryRepository(sql)
    scenarioRepo = new PostgresScenarioRepository(sql)
    sessionRepo = new PostgresSessionRepository(sql)
    avatarRepo = new PostgresAvatarRepository(sql)
    conversationRepo = new PostgresConversationRepository(sql)
  })

  afterEach(async () => {
    await truncateAllTables(sql)
    const scenario = await scenarioRepo.create({ name: 'Episodic harness', status: 'active' })
    scenarioId = scenario.scenarioId
    const avatar = await avatarRepo.create({
      scenarioId,
      name: 'Guide',
      personaPrompt: 'Guide',
      status: 'active',
    })
    avatarId = avatar.avatarId
    const session = await sessionRepo.create({ userId: 'user_1', scenarioId })
    sessionId = session.sessionId
    const conversation = await conversationRepo.create({
      sessionId,
      avatarId,
      startedBy: 'user',
    })
    conversationId = conversation.conversationId
  })

  afterAll(async () => {
    await truncateAllTables(sql)
    await sql.end()
  })

  it('creates one row per conversation and keeps it immutable', async () => {
    const first = await repository.create({
      conversationId,
      sessionId,
      userId: 'user_1',
      avatarId,
      scenarioId,
      summary: 'episode one',
      keyDiscoveries: ['d1'],
      unresolvedTopics: ['u1'],
      factCandidates: [{ category: 'conversation_signal', key: 'k1', value: 'v1' }],
    })
    const second = await repository.create({
      conversationId,
      sessionId,
      userId: 'user_1',
      avatarId,
      scenarioId,
      summary: 'episode two',
      keyDiscoveries: ['d2'],
      unresolvedTopics: ['u2'],
      factCandidates: [{ category: 'conversation_signal', key: 'k2', value: 'v2' }],
    })
    expect(second.summary).toBe(first.summary)
  })
})

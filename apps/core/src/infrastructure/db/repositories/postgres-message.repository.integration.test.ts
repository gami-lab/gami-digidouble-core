import type { Sql } from 'postgres'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { PostgresMessageRepository } from './postgres-message.repository.js'
import { PostgresScenarioRepository } from './postgres-scenario.repository.js'
import { PostgresSessionRepository } from './postgres-session.repository.js'

let sql: Sql
let messageRepo: PostgresMessageRepository
let sessionId: string

function defineSaveTests(): void {
  it('saves a message and returns it', async () => {
    const saved = await messageRepo.save({
      messageId: 'msg_11111111-1111-1111-1111-111111111111',
      sessionId,
      role: 'user',
      content: 'Hello!',
      createdAt: new Date().toISOString(),
    })

    expect(saved.messageId).toBe('msg_11111111-1111-1111-1111-111111111111')
    expect(saved.sessionId).toBe(sessionId)
    expect(saved.role).toBe('user')
    expect(saved.content).toBe('Hello!')
    expect(saved.metadata).toBeUndefined()
  })

  it('saves a message with metadata', async () => {
    const saved = await messageRepo.save({
      messageId: 'msg_22222222-2222-2222-2222-222222222222',
      sessionId,
      role: 'avatar',
      content: 'Hi there!',
      createdAt: new Date().toISOString(),
      metadata: { model: 'gpt-4o', latencyMs: 300 },
    })

    expect(saved.metadata).toEqual({ model: 'gpt-4o', latencyMs: 300 })
  })
}

function defineFindTests(): void {
  it('findBySessionId returns messages in chronological order', async () => {
    const t1 = new Date(Date.now() - 2000).toISOString()
    const t2 = new Date(Date.now() - 1000).toISOString()
    const t3 = new Date().toISOString()

    await messageRepo.save({
      messageId: 'msg_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      sessionId,
      role: 'user',
      content: 'First',
      createdAt: t1,
    })
    await messageRepo.save({
      messageId: 'msg_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      sessionId,
      role: 'avatar',
      content: 'Second',
      createdAt: t2,
    })
    await messageRepo.save({
      messageId: 'msg_cccccccc-cccc-cccc-cccc-cccccccccccc',
      sessionId,
      role: 'user',
      content: 'Third',
      createdAt: t3,
    })

    const messages = await messageRepo.findBySessionId(sessionId)
    expect(messages).toHaveLength(3)
    expect(messages[0]?.content).toBe('First')
    expect(messages[2]?.content).toBe('Third')
  })

  it('findBySessionId respects the limit option', async () => {
    const t1 = new Date(Date.now() - 2000).toISOString()
    const t2 = new Date(Date.now() - 1000).toISOString()
    const t3 = new Date().toISOString()

    await messageRepo.save({
      messageId: 'msg_dddddddd-dddd-dddd-dddd-dddddddddddd',
      sessionId,
      role: 'user',
      content: 'A',
      createdAt: t1,
    })
    await messageRepo.save({
      messageId: 'msg_eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      sessionId,
      role: 'avatar',
      content: 'B',
      createdAt: t2,
    })
    await messageRepo.save({
      messageId: 'msg_ffffffff-ffff-ffff-ffff-ffffffffffff',
      sessionId,
      role: 'user',
      content: 'C',
      createdAt: t3,
    })

    const limited = await messageRepo.findBySessionId(sessionId, { limit: 2 })
    expect(limited).toHaveLength(2)
  })

  it('findBySessionId returns empty array when session has no messages', async () => {
    const result = await messageRepo.findBySessionId('00000000-0000-0000-0000-000000000000')
    expect(result).toEqual([])
  })
}

function defineDeleteTests(): void {
  it('deleteBySessionId removes all messages and returns the count', async () => {
    await messageRepo.save({
      messageId: 'msg_11111112-1111-1111-1111-111111111111',
      sessionId,
      role: 'user',
      content: 'A',
      createdAt: new Date().toISOString(),
    })
    await messageRepo.save({
      messageId: 'msg_11111113-1111-1111-1111-111111111111',
      sessionId,
      role: 'avatar',
      content: 'B',
      createdAt: new Date().toISOString(),
    })

    const count = await messageRepo.deleteBySessionId(sessionId)
    expect(count).toBe(2)

    const remaining = await messageRepo.findBySessionId(sessionId)
    expect(remaining).toHaveLength(0)
  })
}

describe.skipIf(!DB_AVAILABLE)('PostgresMessageRepository', () => {
  beforeAll(async () => {
    sql = await createTestSql()
    const scenarioRepo = new PostgresScenarioRepository(sql)
    const sessionRepo = new PostgresSessionRepository(sql)
    messageRepo = new PostgresMessageRepository(sql)

    const scenario = await scenarioRepo.create({
      name: 'Harness',
    })
    const session = await sessionRepo.create({
      userId: 'user-1',
      scenarioId: scenario.scenarioId,
    })
    sessionId = session.sessionId
  })

  afterEach(async () => {
    await sql`TRUNCATE messages`
  })

  afterAll(async () => {
    await truncateAllTables(sql)
    await sql.end()
  })

  defineSaveTests()
  defineFindTests()
  defineDeleteTests()
})

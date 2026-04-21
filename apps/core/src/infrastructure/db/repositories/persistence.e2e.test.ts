import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Sql } from 'postgres'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { PostgresAvatarRepository } from './postgres-avatar.repository.js'
import { PostgresMessageRepository } from './postgres-message.repository.js'
import { PostgresScenarioRepository } from './postgres-scenario.repository.js'
import { PostgresSessionRepository } from './postgres-session.repository.js'

describe.skipIf(!DB_AVAILABLE)('Persistence stack — end-to-end', () => {
  let sql: Sql

  beforeAll(async () => {
    sql = createTestSql()
    await truncateAllTables(sql)
  })

  afterAll(async () => {
    await truncateAllTables(sql)
    await sql.end()
  })

  it('persists the full conversation fixture across repository instances', async () => {
    const scenarioRepo1 = new PostgresScenarioRepository(sql)
    const avatarRepo1 = new PostgresAvatarRepository(sql)
    const sessionRepo1 = new PostgresSessionRepository(sql)
    const messageRepo1 = new PostgresMessageRepository(sql)

    const scenario = await scenarioRepo1.create({
      name: 'Stack E2E Scenario',
      status: 'active',
    })

    const avatar = await avatarRepo1.create({
      scenarioId: scenario.scenarioId,
      name: 'Stack E2E Avatar',
      personaPrompt: 'You are a stack e2e avatar.',
      status: 'active',
    })

    const session = await sessionRepo1.create({
      userId: 'stack-e2e-user',
      scenarioId: scenario.scenarioId,
    })

    await messageRepo1.save({
      messageId: crypto.randomUUID(),
      sessionId: session.sessionId,
      role: 'user',
      content: 'Hello from stack e2e!',
      createdAt: new Date().toISOString(),
    })

    const scenarioRepo2 = new PostgresScenarioRepository(sql)
    const avatarRepo2 = new PostgresAvatarRepository(sql)
    const sessionRepo2 = new PostgresSessionRepository(sql)
    const messageRepo2 = new PostgresMessageRepository(sql)

    const foundScenario = await scenarioRepo2.findById(scenario.scenarioId)
    const foundAvatar = await avatarRepo2.findById(avatar.avatarId)
    const foundSession = await sessionRepo2.findById(session.sessionId)
    const foundMessages = await messageRepo2.findBySessionId(session.sessionId)

    expect(foundScenario).toMatchObject({ name: 'Stack E2E Scenario' })

    expect(foundAvatar).toMatchObject({
      personaPrompt: 'You are a stack e2e avatar.',
    })

    expect(foundSession).toMatchObject({ userId: 'stack-e2e-user' })

    expect(foundMessages).toHaveLength(1)
    expect(foundMessages[0]).toMatchObject({ content: 'Hello from stack e2e!' })
  })
})

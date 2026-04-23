import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Sql } from 'postgres'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { GetAvatarTransitionsUseCase } from '../../../application/use-cases/get-avatar-transitions/get-avatar-transitions.use-case.js'
import { SwitchAvatarUseCase } from '../../../application/use-cases/switch-avatar/switch-avatar.use-case.js'
import { PostgresAvatarRepository } from './postgres-avatar.repository.js'
import { PostgresConversationRepository } from './postgres-conversation.repository.js'
import { PostgresMessageRepository } from './postgres-message.repository.js'
import { PostgresScenarioRepository } from './postgres-scenario.repository.js'
import { PostgresSessionRepository } from './postgres-session.repository.js'

describe.skipIf(!DB_AVAILABLE)('Persistence stack — fixture roundtrip', () => {
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
    const conversationRepo1 = new PostgresConversationRepository(sql)
    const messageRepo1 = new PostgresMessageRepository(sql)

    const scenario = await scenarioRepo1.create({ name: 'Stack E2E Scenario', status: 'active' })
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
    const conversation = await conversationRepo1.create({
      sessionId: session.sessionId,
      avatarId: avatar.avatarId,
      startedBy: 'user',
    })

    await messageRepo1.save({
      messageId: crypto.randomUUID(),
      conversationId: conversation.conversationId,
      role: 'user',
      content: 'Hello from stack e2e!',
      createdAt: new Date().toISOString(),
    })

    const scenarioRepo2 = new PostgresScenarioRepository(sql)
    const avatarRepo2 = new PostgresAvatarRepository(sql)
    const sessionRepo2 = new PostgresSessionRepository(sql)
    const conversationRepo2 = new PostgresConversationRepository(sql)
    const messageRepo2 = new PostgresMessageRepository(sql)

    const foundScenario = await scenarioRepo2.findById(scenario.scenarioId)
    const foundAvatar = await avatarRepo2.findById(avatar.avatarId)
    const foundSession = await sessionRepo2.findById(session.sessionId)
    const foundConversations = await conversationRepo2.listBySessionId(session.sessionId)
    const foundMessages = await messageRepo2.findByConversationId(conversation.conversationId)

    expect(foundScenario).toMatchObject({ name: 'Stack E2E Scenario' })
    expect(foundAvatar).toMatchObject({ personaPrompt: 'You are a stack e2e avatar.' })
    expect(foundSession).toMatchObject({ userId: 'stack-e2e-user' })
    expect(foundConversations).toHaveLength(1)
    expect(foundMessages).toHaveLength(1)
    expect(foundMessages[0]).toMatchObject({ content: 'Hello from stack e2e!' })
  })
})

describe.skipIf(!DB_AVAILABLE)('Persistence stack — multi-avatar switch flow', () => {
  let sql: Sql

  beforeAll(async () => {
    sql = createTestSql()
    await truncateAllTables(sql)
  })

  afterAll(async () => {
    await truncateAllTables(sql)
    await sql.end()
  })

  it('persists multi-avatar switch flow and transition linkage across Postgres repositories', async () => {
    const scenarioRepo = new PostgresScenarioRepository(sql)
    const avatarRepo = new PostgresAvatarRepository(sql)
    const sessionRepo = new PostgresSessionRepository(sql)
    const conversationRepo = new PostgresConversationRepository(sql)

    const scenario = await scenarioRepo.create({ name: 'Multi-Avatar Scenario', status: 'active' })
    const avatar1 = await avatarRepo.create({
      scenarioId: scenario.scenarioId,
      name: 'Avatar One',
      personaPrompt: 'You are avatar one.',
      status: 'active',
    })
    const avatar2 = await avatarRepo.create({
      scenarioId: scenario.scenarioId,
      name: 'Avatar Two',
      personaPrompt: 'You are avatar two.',
      status: 'active',
    })
    const session = await sessionRepo.create({
      userId: 'multi-avatar-user',
      scenarioId: scenario.scenarioId,
    })

    const conversationA = await conversationRepo.create({
      sessionId: session.sessionId,
      avatarId: avatar1.avatarId,
      startedBy: 'user',
    })
    await sessionRepo.update(session.sessionId, { activeAvatarId: avatar1.avatarId })

    const switchAvatarUseCase = new SwitchAvatarUseCase(sessionRepo, avatarRepo, conversationRepo)
    const switchOutput = await switchAvatarUseCase.execute({
      sessionId: session.sessionId,
      avatarId: avatar2.avatarId,
    })

    const conversationB = await conversationRepo.findById(switchOutput.conversation.conversationId)
    const reloadedConversationA = await conversationRepo.findById(conversationA.conversationId)
    const reloadedSession = await sessionRepo.findById(session.sessionId)

    expect(reloadedSession?.activeAvatarId).toBe(avatar2.avatarId)
    expect(reloadedConversationA?.status).toBe('closed')
    expect(conversationB?.status).toBe('active')
    expect(conversationB?.handoffFromConversationId).toBe(conversationA.conversationId)

    const getAvatarTransitionsUseCase = new GetAvatarTransitionsUseCase(
      sessionRepo,
      conversationRepo,
    )
    const transitionsOutput = await getAvatarTransitionsUseCase.execute({
      sessionId: session.sessionId,
    })

    expect(transitionsOutput.transitions).toHaveLength(2)
    expect(transitionsOutput.transitions[0]).toMatchObject({
      toConversationId: conversationA.conversationId,
      toAvatarId: avatar1.avatarId,
      fromConversationId: null,
      fromAvatarId: null,
      reason: 'session_start',
    })
    expect(transitionsOutput.transitions[1]).toMatchObject({
      toConversationId: switchOutput.conversation.conversationId,
      toAvatarId: avatar2.avatarId,
      fromConversationId: conversationA.conversationId,
      fromAvatarId: avatar1.avatarId,
      reason: 'manual_switch',
    })
  })
})

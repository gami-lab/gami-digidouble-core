import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiResponse } from '@gami/shared'
import type { FastifyInstance } from 'fastify'
import type { Config } from '../../config.js'
import { createServer } from '../server.js'
import { InMemoryAvatarRepository } from '../../infrastructure/db/in-memory-avatar.repository.js'
import { InMemoryConversationRepository } from '../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryEventLogRepository } from '../../infrastructure/db/in-memory-event-log.repository.js'
import { InMemoryMessageRepository } from '../../infrastructure/db/in-memory-message.repository.js'
import { InMemoryScenarioRepository } from '../../infrastructure/db/in-memory-scenario.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { InMemorySessionMemoryRepository } from '../../infrastructure/db/in-memory-session-memory.repository.js'
import { InMemoryAvatarSessionMemoryRepository } from '../../infrastructure/db/in-memory-avatar-session-memory.repository.js'
import { InMemoryUserRepository } from '../../infrastructure/db/in-memory-user.repository.js'
import type { RunGameMasterUseCase } from '../../application/use-cases/run-game-master/run-game-master.use-case.js'

const testConfig: Config = {
  port: 3000,
  host: '0.0.0.0',
  nodeEnv: 'test',
  logLevel: 'silent',
  databaseUrl: 'postgresql://test',
  redisUrl: 'redis://test',
  apiKeySecret: 'test-secret',
  corsOrigin: '*',
  llmProvider: 'null',
  openaiApiKey: undefined,
  anthropicApiKey: undefined,
  mistralApiKey: undefined,
  langfusePublicKey: undefined,
  langfuseSecretKey: undefined,
  langfuseHost: undefined,
}

const appsToClose: FastifyInstance[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(appsToClose.splice(0).map(async (app) => app.close()))
})

function authHeaders(apiKey = 'test-secret'): { 'x-api-key': string } {
  return { 'x-api-key': apiKey }
}

function makeApp() {
  const eventLogRepository = new InMemoryEventLogRepository()
  const runGameMasterExecute = vi.fn().mockResolvedValue(undefined)
  const runGameMasterUseCase = {
    execute: runGameMasterExecute,
  } as unknown as RunGameMasterUseCase

  const app = createServer(testConfig, {
    scenarioRepository: new InMemoryScenarioRepository([
      {
        scenarioId: 'scenario_1',
        name: 'Scenario',
        status: 'active',
        config: {},
        createdAt: '2026-05-01T10:00:00.000Z',
        updatedAt: '2026-05-01T10:00:00.000Z',
      },
    ]),
    avatarRepository: new InMemoryAvatarRepository([
      {
        avatarId: 'avatar_1',
        scenarioId: 'scenario_1',
        name: 'Guide',
        status: 'active',
        personaPrompt: 'You are guide.',
        config: {},
        createdAt: '2026-05-01T10:00:00.000Z',
        updatedAt: '2026-05-01T10:00:00.000Z',
      },
    ]),
    sessionRepository: new InMemorySessionRepository([
      {
        sessionId: 'session_1',
        userId: 'user_1',
        scenarioId: 'scenario_1',
        gmNotes: 'nudge',
        memorySummary: 'legacy summary',
        status: 'active',
        startedAt: '2026-05-01T10:00:00.000Z',
        lastActivityAt: '2026-05-01T10:00:00.000Z',
      },
    ]),
    conversationRepository: new InMemoryConversationRepository([
      {
        conversationId: 'conversation_1',
        sessionId: 'session_1',
        avatarId: 'avatar_1',
        status: 'active',
        startedAt: '2026-05-01T10:00:00.000Z',
        lastActivityAt: '2026-05-01T10:10:00.000Z',
      },
    ]),
    messageRepository: new InMemoryMessageRepository([
      {
        messageId: 'msg_1',
        conversationId: 'conversation_1',
        role: 'user',
        content: 'hello',
        createdAt: '2026-05-01T10:01:00.000Z',
      },
    ]),
    eventLogRepository,
    runGameMasterUseCase,
    userRepository: new InMemoryUserRepository([
      {
        userId: 'user_1',
        persona: { name: 'Maya', roleInWorld: 'student' },
        createdAt: '2026-05-01T10:00:00.000Z',
        updatedAt: '2026-05-01T10:00:00.000Z',
      },
    ]),
    sessionMemoryRepository: new InMemorySessionMemoryRepository([
      {
        sessionId: 'session_1',
        summary: 'session summary',
        updatedAt: '2026-05-01T10:05:00.000Z',
      },
    ]),
    avatarSessionMemoryRepository: new InMemoryAvatarSessionMemoryRepository([
      {
        sessionId: 'session_1',
        avatarId: 'avatar_1',
        summary: 'avatar summary',
        updatedAt: '2026-05-01T10:05:00.000Z',
      },
    ]),
  })
  appsToClose.push(app)
  return { app, eventLogRepository, runGameMasterExecute }
}

describe('admin runtime actions auth/not found', () => {
  it('requires auth for replay endpoint', async () => {
    const { app } = makeApp()
    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/sessions/session_1/gm/replay',
    })
    expect(response.statusCode).toBe(401)
  })

  it('returns 404 for missing session on memory refresh', async () => {
    const { app } = makeApp()
    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/sessions/missing/memory/refresh',
      headers: authHeaders(),
    })
    expect(response.statusCode).toBe(404)
    expect(response.json<ApiResponse<null>>().error?.code).toBe('NOT_FOUND')
  })
})

describe('admin runtime actions behavior', () => {
  it('replays gm and appends audit event', async () => {
    const { app, runGameMasterExecute, eventLogRepository } = makeApp()
    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/sessions/session_1/gm/replay',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(200)
    expect(runGameMasterExecute).toHaveBeenCalledTimes(1)
    const body =
      response.json<ApiResponse<{ action: string; scheduled: boolean; sessionId: string }>>()
    expect(body.data?.action).toBe('gm.replay')
    expect(body.data?.scheduled).toBe(true)
    const events = await eventLogRepository.findBySessionId('session_1')
    expect(events.some((event) => event.type === 'admin_action.gm_replay')).toBe(true)
  })

  it('refreshes memory asynchronously and appends audit event', async () => {
    const { app, eventLogRepository } = makeApp()
    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/sessions/session_1/memory/refresh',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<ApiResponse<{ action: string; scheduled: boolean }>>()
    expect(body.data?.action).toBe('memory.refresh')
    expect(body.data?.scheduled).toBe(true)
    const events = await eventLogRepository.findBySessionId('session_1')
    expect(events.some((event) => event.type === 'admin_action.memory_refresh')).toBe(true)
  })

  it('clears session-scoped memory and does not clear user facts', async () => {
    const { app, eventLogRepository } = makeApp()
    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/sessions/session_1/memory/clear',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(200)
    const body = response.json<
      ApiResponse<{
        action: string
        cleared: {
          sessionWorkingMemory: boolean
          avatarWorkingMemoryCount: number
          userFactsCleared: false
          gmNotesCleared: boolean
          legacySessionSummaryCleared: boolean
        }
      }>
    >()
    expect(body.data?.action).toBe('memory.clear')
    expect(body.data?.cleared.sessionWorkingMemory).toBe(true)
    expect(body.data?.cleared.avatarWorkingMemoryCount).toBe(1)
    expect(body.data?.cleared.userFactsCleared).toBe(false)
    const events = await eventLogRepository.findBySessionId('session_1')
    expect(events.some((event) => event.type === 'admin_action.memory_clear')).toBe(true)
  })
})

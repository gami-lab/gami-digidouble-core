import { describe, expect, it, vi } from 'vitest'
import { InMemoryAvatarSessionMemoryRepository } from '../../infrastructure/db/in-memory-avatar-session-memory.repository.js'
import { InMemoryEventLogRepository } from '../../infrastructure/db/in-memory-event-log.repository.js'
import { InMemoryMessageRepository } from '../../infrastructure/db/in-memory-message.repository.js'
import { InMemorySessionMemoryRepository } from '../../infrastructure/db/in-memory-session-memory.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { MemoryMaintenanceService } from './memory-maintenance.service.js'

function makeService() {
  const messageRepository = new InMemoryMessageRepository([
    {
      messageId: 'msg_1',
      conversationId: 'conversation_1',
      role: 'user',
      content: 'How should I start?',
      createdAt: '2026-05-06T10:00:00.000Z',
    },
    {
      messageId: 'msg_2',
      conversationId: 'conversation_1',
      role: 'avatar',
      content: 'Start with a small concrete step.',
      createdAt: '2026-05-06T10:00:01.000Z',
    },
  ])
  const sessionRepository = new InMemorySessionRepository([
    {
      sessionId: 'session_1',
      userId: 'user_1',
      scenarioId: 'scenario_1',
      status: 'active',
      startedAt: '2026-05-06T09:59:00.000Z',
      lastActivityAt: '2026-05-06T10:00:01.000Z',
    },
  ])
  const sessionMemoryRepository = new InMemorySessionMemoryRepository()
  const avatarSessionMemoryRepository = new InMemoryAvatarSessionMemoryRepository()
  const eventLogRepository = new InMemoryEventLogRepository()

  return {
    service: new MemoryMaintenanceService(
      messageRepository,
      sessionRepository,
      sessionMemoryRepository,
      avatarSessionMemoryRepository,
      eventLogRepository,
    ),
    sessionRepository,
    sessionMemoryRepository,
    avatarSessionMemoryRepository,
    eventLogRepository,
  }
}

describe('MemoryMaintenanceService — persistence and events', () => {
  it('refreshes session and avatar working memory and updates legacy session mirror', async () => {
    const { service, sessionRepository, sessionMemoryRepository, avatarSessionMemoryRepository } =
      makeService()

    await service.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      trigger: 'post_turn',
      correlationId: 'corr_1',
    })

    await expect(sessionMemoryRepository.findBySessionId('session_1')).resolves.toMatchObject({
      sessionId: 'session_1',
    })
    await expect(
      avatarSessionMemoryRepository.findBySessionIdAndAvatarId('session_1', 'avatar_1'),
    ).resolves.toMatchObject({ sessionId: 'session_1', avatarId: 'avatar_1' })

    const session = await sessionRepository.findById('session_1')
    expect(session?.memorySummary).toContain('Conversation turns: user=1, avatar=1.')
  })

  it('updates existing rows on repeated turns rather than creating duplicates', async () => {
    const { service, sessionMemoryRepository, avatarSessionMemoryRepository } = makeService()

    await service.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      trigger: 'post_turn',
    })
    const firstSessionMemory = await sessionMemoryRepository.findBySessionId('session_1')
    const firstAvatarMemory = await avatarSessionMemoryRepository.findBySessionIdAndAvatarId(
      'session_1',
      'avatar_1',
    )

    await service.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      trigger: 'post_turn',
    })
    const secondSessionMemory = await sessionMemoryRepository.findBySessionId('session_1')
    const secondAvatarMemory = await avatarSessionMemoryRepository.findBySessionIdAndAvatarId(
      'session_1',
      'avatar_1',
    )

    expect(secondSessionMemory?.sessionId).toBe(firstSessionMemory?.sessionId)
    expect(secondAvatarMemory?.avatarId).toBe(firstAvatarMemory?.avatarId)
  })
})

describe('MemoryMaintenanceService — event payload contract', () => {
  it('emits triggered and succeeded events with correct payload fields', async () => {
    const { service, eventLogRepository } = makeService()

    await service.execute({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      trigger: 'post_turn',
      correlationId: 'corr_1',
    })

    const events = eventLogRepository.getAll()
    const types = events.map((event) => event.type)
    expect(types).toContain('memory_refresh_triggered')
    expect(types).toContain('memory_refresh_succeeded')

    const triggered = events.find((e) => e.type === 'memory_refresh_triggered')
    expect(triggered?.payload).toMatchObject({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      trigger: 'post_turn',
    })
    expect(triggered?.correlationId).toBe('corr_1')

    const succeeded = events.find((e) => e.type === 'memory_refresh_succeeded')
    expect(succeeded?.payload).toMatchObject({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      trigger: 'post_turn',
      messageCount: 2,
    })
    const succeededPayload = succeeded?.payload
    expect(typeof succeededPayload?.sessionSummaryLength).toBe('number')
    expect(typeof succeededPayload?.avatarSummaryLength).toBe('number')
    expect(succeeded?.correlationId).toBe('corr_1')
  })

  it('emits memory_refresh_failed with correct payload when persistence fails', async () => {
    const {
      sessionRepository,
      sessionMemoryRepository,
      avatarSessionMemoryRepository,
      eventLogRepository,
    } = makeService()
    const messageRepository = {
      findByConversationId: vi.fn().mockRejectedValue(new Error('messages unavailable')),
      save: vi.fn(),
      deleteByConversationId: vi.fn(),
    }
    const service = new MemoryMaintenanceService(
      messageRepository,
      sessionRepository,
      sessionMemoryRepository,
      avatarSessionMemoryRepository,
      eventLogRepository,
    )

    await expect(
      service.execute({
        sessionId: 'session_1',
        conversationId: 'conversation_1',
        avatarId: 'avatar_1',
        trigger: 'conversation_closed',
      }),
    ).resolves.toBeUndefined()

    const events = eventLogRepository.getAll()
    const types = events.map((event) => event.type)
    expect(types).toContain('memory_refresh_triggered')
    expect(types).toContain('memory_refresh_failed')

    const failed = events.find((e) => e.type === 'memory_refresh_failed')
    expect(failed?.payload).toMatchObject({
      sessionId: 'session_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      trigger: 'conversation_closed',
      error: 'messages unavailable',
    })
  })
})

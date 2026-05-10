import { describe, expect, it, vi } from 'vitest'
import { DomainError } from '../../../domain/errors.js'
import { InMemoryAvatarSessionMemoryRepository } from '../../../infrastructure/db/in-memory-avatar-session-memory.repository.js'
import { InMemoryConversationRepository } from '../../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemoryEventLogRepository } from '../../../infrastructure/db/in-memory-event-log.repository.js'
import { InMemoryMessageRepository } from '../../../infrastructure/db/in-memory-message.repository.js'
import { InMemorySessionMemoryRepository } from '../../../infrastructure/db/in-memory-session-memory.repository.js'
import { InMemorySessionRepository } from '../../../infrastructure/db/in-memory-session.repository.js'
import { InMemoryUserRepository } from '../../../infrastructure/db/in-memory-user.repository.js'
import { InMemoryConversationWorkingMemoryRepository } from '../../../infrastructure/db/in-memory-conversation-working-memory.repository.js'
import type { IMemoryMaintenancePort } from '../../ports/IMemoryMaintenancePort.js'
import { AdminRuntimeActionsUseCase } from './admin-runtime-actions.use-case.js'

function buildUseCase() {
  const fixtures = makeFixtures()
  const sessionRepository = new InMemorySessionRepository([fixtures.session])
  const conversationRepository = new InMemoryConversationRepository([fixtures.conversation])
  const messageRepository = new InMemoryMessageRepository(fixtures.messages)
  const eventLogRepository = new InMemoryEventLogRepository()
  const sessionMemoryRepository = new InMemorySessionMemoryRepository([fixtures.sessionMemory])
  const avatarSessionMemoryRepository = new InMemoryAvatarSessionMemoryRepository([
    fixtures.avatarSessionMemory,
  ])
  const conversationWorkingMemoryRepository = new InMemoryConversationWorkingMemoryRepository([
    {
      conversationId: 'conversation_1',
      sessionId: 'session_1',
      avatarId: 'avatar_1',
      summary: 'Conversation summary',
      unresolvedThreads: ['Need pricing'],
      candidateFacts: [{ category: 'conversation_signal', key: 'thread_1', value: 'Need pricing' }],
      updatedAt: '2026-05-07T10:03:00.000Z',
    },
  ])
  const runGameMasterExecute = vi.fn().mockResolvedValue(undefined)
  const runGameMasterUseCase = { execute: runGameMasterExecute }
  const memoryMaintenanceExecute = vi.fn().mockResolvedValue(undefined)
  const memoryMaintenance: IMemoryMaintenancePort = {
    execute: memoryMaintenanceExecute,
  }
  const userRepository = new InMemoryUserRepository([fixtures.user])

  const useCase = new AdminRuntimeActionsUseCase(
    sessionRepository,
    conversationRepository,
    messageRepository,
    eventLogRepository,
    sessionMemoryRepository,
    avatarSessionMemoryRepository,
    conversationWorkingMemoryRepository,
    memoryMaintenance,
    runGameMasterUseCase as never,
    userRepository,
  )

  return {
    useCase,
    eventLogRepository,
    memoryMaintenanceExecute,
    runGameMasterExecute,
    sessionRepository,
  }
}

function makeFixtures() {
  return {
    session: {
      sessionId: 'session_1',
      userId: 'user_1',
      scenarioId: 'scenario_1',
      gmNotes: 'Keep momentum.',
      memorySummary: 'Legacy memory summary.',
      status: 'active' as const,
      startedAt: '2026-05-07T10:00:00.000Z',
      lastActivityAt: '2026-05-07T10:00:00.000Z',
    },
    conversation: {
      conversationId: 'conversation_1',
      sessionId: 'session_1',
      avatarId: 'avatar_1',
      status: 'active' as const,
      startedAt: '2026-05-07T10:00:00.000Z',
      lastActivityAt: '2026-05-07T10:05:00.000Z',
    },
    messages: [
      {
        messageId: 'm1',
        conversationId: 'conversation_1',
        role: 'user' as const,
        content: 'First user turn',
        createdAt: '2026-05-07T10:01:00.000Z',
      },
      {
        messageId: 'm2',
        conversationId: 'conversation_1',
        role: 'avatar' as const,
        content: 'Avatar answer',
        createdAt: '2026-05-07T10:01:01.000Z',
      },
      {
        messageId: 'm3',
        conversationId: 'conversation_1',
        role: 'user' as const,
        content: 'Replay this turn',
        createdAt: '2026-05-07T10:02:00.000Z',
      },
    ],
    sessionMemory: {
      sessionId: 'session_1',
      summary: 'Session working summary',
      updatedAt: '2026-05-07T10:03:00.000Z',
    },
    avatarSessionMemory: {
      sessionId: 'session_1',
      avatarId: 'avatar_1',
      summary: 'Avatar working summary',
      updatedAt: '2026-05-07T10:03:00.000Z',
    },
    user: {
      userId: 'user_1',
      persona: { name: 'Maya', roleInWorld: 'student' },
      createdAt: '2026-05-07T10:00:00.000Z',
      updatedAt: '2026-05-07T10:00:00.000Z',
    },
  }
}

describe('AdminRuntimeActionsUseCase replay', () => {
  it('replays GM from latest user turn and appends an audit event', async () => {
    const { useCase, eventLogRepository, runGameMasterExecute } = buildUseCase()

    const output = await useCase.replayGm({ sessionId: 'session_1' })

    expect(output.action).toBe('gm.replay')
    expect(output.scheduled).toBe(true)
    expect(output.conversationId).toBe('conversation_1')
    expect(output.avatarId).toBe('avatar_1')
    expect(output.turnIndex).toBe(2)
    expect(output.correlationId.startsWith('admin_gm_replay_')).toBe(true)
    expect(runGameMasterExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session_1',
        scenarioId: 'scenario_1',
        conversationId: 'conversation_1',
        avatarId: 'avatar_1',
        userMessageText: 'Replay this turn',
        turnIndex: 2,
        userPersona: { name: 'Maya', roleInWorld: 'student' },
      }),
    )

    const events = await eventLogRepository.findBySessionId('session_1')
    expect(events[0]?.type).toBe('admin_action.gm_replay')
    expect(events[0]?.correlationId).toBe(output.correlationId)
  })

  it('throws CONFLICT when replay target has no user turn', async () => {
    const sessionRepository = new InMemorySessionRepository([
      {
        sessionId: 'session_1',
        userId: 'user_1',
        scenarioId: 'scenario_1',
        status: 'active',
        startedAt: '2026-05-07T10:00:00.000Z',
        lastActivityAt: '2026-05-07T10:00:00.000Z',
      },
    ])
    const conversationRepository = new InMemoryConversationRepository([
      {
        conversationId: 'conversation_1',
        sessionId: 'session_1',
        avatarId: 'avatar_1',
        status: 'active',
        startedAt: '2026-05-07T10:00:00.000Z',
        lastActivityAt: '2026-05-07T10:05:00.000Z',
      },
    ])
    const useCase = new AdminRuntimeActionsUseCase(
      sessionRepository,
      conversationRepository,
      new InMemoryMessageRepository([
        {
          messageId: 'm1',
          conversationId: 'conversation_1',
          role: 'avatar',
          content: 'Only avatar output',
          createdAt: '2026-05-07T10:01:00.000Z',
        },
      ]),
      new InMemoryEventLogRepository(),
    )

    await expect(useCase.replayGm({ sessionId: 'session_1' })).rejects.toEqual(
      new DomainError('CONFLICT', 'Cannot replay GM for session session_1 without a user turn.'),
    )
  })
})

describe('AdminRuntimeActionsUseCase refresh', () => {
  it('refreshes memory asynchronously and appends audit event', async () => {
    const { useCase, memoryMaintenanceExecute, eventLogRepository } = buildUseCase()

    const output = await useCase.refreshMemory({ sessionId: 'session_1' })

    expect(output.action).toBe('memory.refresh')
    expect(output.scheduled).toBe(true)
    expect(output.avatarId).toBe('avatar_1')
    expect(output.correlationId.startsWith('admin_memory_refresh_')).toBe(true)
    expect(memoryMaintenanceExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session_1',
        conversationId: 'conversation_1',
        avatarId: 'avatar_1',
        trigger: 'admin_trigger',
      }),
    )

    const events = await eventLogRepository.findBySessionId('session_1')
    expect(events[0]?.type).toBe('admin_action.memory_refresh')
  })
})

describe('AdminRuntimeActionsUseCase clear', () => {
  it('reports pre-cleared flags correctly when gm notes and legacy summary are absent', async () => {
    const sessionRepository = new InMemorySessionRepository([
      {
        sessionId: 'session_2',
        userId: 'user_2',
        scenarioId: 'scenario_1',
        status: 'active',
        startedAt: '2026-05-07T10:00:00.000Z',
        lastActivityAt: '2026-05-07T10:00:00.000Z',
      },
    ])
    const useCase = new AdminRuntimeActionsUseCase(
      sessionRepository,
      new InMemoryConversationRepository([]),
      new InMemoryMessageRepository([]),
      new InMemoryEventLogRepository(),
      new InMemorySessionMemoryRepository([]),
      new InMemoryAvatarSessionMemoryRepository([]),
      new InMemoryConversationWorkingMemoryRepository([]),
    )

    const output = await useCase.clearMemory({ sessionId: 'session_2' })

    expect(output.action).toBe('memory.clear')
    expect(output.cleared.gmNotesCleared).toBe(false)
    expect(output.cleared.legacySessionSummaryCleared).toBe(false)
  })

  it('clears session and avatar memory and reports cleared flags when values existed', async () => {
    const { useCase, sessionRepository } = buildUseCase()

    const output = await useCase.clearMemory({ sessionId: 'session_1' })

    expect(output.cleared.sessionWorkingMemory).toBe(true)
    expect(output.cleared.avatarWorkingMemoryCount).toBe(1)
    expect(output.cleared.gmNotesCleared).toBe(true)
    expect(output.cleared.legacySessionSummaryCleared).toBe(true)
    expect(output.cleared.userFactsCleared).toBe(false)

    const sessionAfter = await sessionRepository.findById('session_1')
    expect(sessionAfter?.gmNotes).toBeUndefined()
    expect(sessionAfter?.memorySummary).toBeUndefined()
  })
})

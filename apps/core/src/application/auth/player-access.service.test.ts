import { describe, expect, it } from 'vitest'
import { InMemoryConversationRepository } from '../../infrastructure/db/in-memory-conversation.repository.js'
import { InMemorySessionRepository } from '../../infrastructure/db/in-memory-session.repository.js'
import { PlayerAccessService } from './player-access.service.js'

const timestamps = {
  startedAt: '2026-10-18T10:00:00.000Z',
  lastActivityAt: '2026-10-18T10:00:00.000Z',
}

function createService(): PlayerAccessService {
  return new PlayerAccessService(
    new InMemorySessionRepository([
      {
        sessionId: 'session_a',
        userId: 'user_a',
        scenarioId: 'scenario_1',
        unlockedAvatarIds: [],
        status: 'active',
        ...timestamps,
      },
    ]),
    new InMemoryConversationRepository([
      {
        conversationId: 'conversation_a',
        sessionId: 'session_a',
        avatarId: 'avatar_1',
        status: 'active',
        ...timestamps,
      },
      {
        conversationId: 'conversation_orphan',
        sessionId: 'session_missing',
        avatarId: 'avatar_1',
        status: 'active',
        ...timestamps,
      },
    ]),
  )
}

describe('PlayerAccessService', () => {
  it('lets the owner through for sessions and conversations', async () => {
    const service = createService()

    await expect(service.requireSession('session_a', 'user_a')).resolves.toBeUndefined()
    await expect(service.requireConversation('conversation_a', 'user_a')).resolves.toBeUndefined()
  })

  it('reports a foreign session exactly like a missing one', async () => {
    const service = createService()

    const foreign = service.requireSession('session_a', 'user_b')
    const missing = service.requireSession('session_a_missing', 'user_b')

    await expect(foreign).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Session session_a was not found.',
    })
    await expect(missing).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('resolves conversation ownership through its session', async () => {
    const service = createService()

    await expect(service.requireConversation('conversation_a', 'user_b')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Conversation conversation_a was not found.',
    })
    await expect(
      service.requireConversation('conversation_orphan', 'user_a'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(service.requireConversation('conversation_none', 'user_a')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })
})

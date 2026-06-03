/**
 * Episodic continuity integration test.
 *
 * Proves the full cross-conversation memory continuity chain:
 *   closed conversation → episodic memory generated → new conversation started →
 *   working memory seeded with prior episodic content.
 *
 * All services use real domain logic with in-memory repositories — no mocks for
 * the memory path.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryConversationMemoryRepository } from '../../../infrastructure/db/in-memory-conversation-memory.repository.js'
import { InMemoryConversationWorkingMemoryRepository } from '../../../infrastructure/db/in-memory-conversation-working-memory.repository.js'
import { InMemoryMessageRepository } from '../../../infrastructure/db/in-memory-message.repository.js'
import { EpisodicMemoryService } from '../../services/episodic-memory.service.js'
import { StartConversationUseCase } from './start-conversation.use-case.js'

const findSessionByIdMock = vi.fn()
const updateSessionMock = vi.fn()
const findAvatarByIdMock = vi.fn()
const createConversationMock = vi.fn()
const appendEventMock = vi.fn()

const sessionRepository = {
  findById: findSessionByIdMock,
  create: vi.fn(),
  update: updateSessionMock,
  delete: vi.fn(),
  list: vi.fn(),
  countByScenarioId: vi.fn(),
  countActiveByScenarioId: vi.fn(),
}

const avatarRepository = {
  findById: findAvatarByIdMock,
  create: vi.fn(),
  listByScenarioId: vi.fn(),
  delete: vi.fn(),
  update: vi.fn(),
}

const conversationRepository = {
  findById: vi.fn(),
  findActiveBySessionId: vi.fn(),
  create: createConversationMock,
  listBySessionId: vi.fn(),
  deleteBySessionId: vi.fn(),
  update: vi.fn(),
}

const eventLogRepository = {
  append: appendEventMock,
  findBySessionId: vi.fn(),
}

beforeEach(() => {
  findSessionByIdMock.mockReset()
  updateSessionMock.mockReset()
  findAvatarByIdMock.mockReset()
  createConversationMock.mockReset()
  appendEventMock.mockReset()
  conversationRepository.findActiveBySessionId.mockResolvedValue(null)

  findSessionByIdMock.mockResolvedValue({
    sessionId: 'session_2',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    status: 'active',
    startedAt: '2026-05-01T10:00:00.000Z',
    lastActivityAt: '2026-05-01T10:00:00.000Z',
  })
  updateSessionMock.mockResolvedValue(undefined)
  findAvatarByIdMock.mockResolvedValue({
    avatarId: 'avatar_1',
    scenarioId: 'scenario_1',
    name: 'Ava',
    status: 'active',
    personaPrompt: 'You are Ava.',
    config: {},
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
  })
  createConversationMock.mockResolvedValue({
    conversationId: 'conversation_2',
    sessionId: 'session_2',
    avatarId: 'avatar_1',
    status: 'active',
    startedAt: '2026-05-01T10:00:00.000Z',
    lastActivityAt: '2026-05-01T10:00:00.000Z',
  })
})

describe('cross-conversation episodic continuity', () => {
  it('working memory of new conversation is seeded with content from closed conversation episodic memory', async () => {
    const conversationMemoryRepository = new InMemoryConversationMemoryRepository()
    const closedConvWorkingMemory = new InMemoryConversationWorkingMemoryRepository([
      {
        conversationId: 'conversation_1',
        sessionId: 'session_1',
        avatarId: 'avatar_1',
        summary: 'Discussed budget and onboarding timeline.',
        unresolvedThreads: ['Need budget approval'],
        candidateFacts: [
          { category: 'conversation_signal', key: 'budget', value: 'pending_approval' },
        ],
        updatedAt: '2026-05-01T09:00:00.000Z',
      },
    ])
    const episodicService = new EpisodicMemoryService(
      conversationMemoryRepository,
      closedConvWorkingMemory,
      new InMemoryMessageRepository([]),
    )

    // Step 1: generate episodic memory from closed conversation
    await episodicService.generateForClosedConversation({
      conversationId: 'conversation_1',
      sessionId: 'session_1',
      userId: 'user_1',
      avatarId: 'avatar_1',
      scenarioId: 'scenario_1',
    })

    // Verify episodic memory was stored
    const storedEpisodic = await conversationMemoryRepository.findByConversationId('conversation_1')
    expect(storedEpisodic).not.toBeNull()
    expect(storedEpisodic?.summary).toContain('budget')

    // Step 2: start new conversation — working memory should be hydrated from the episodic memory
    const newConvWorkingMemory = new InMemoryConversationWorkingMemoryRepository()
    const useCase = new StartConversationUseCase(
      sessionRepository,
      avatarRepository,
      conversationRepository,
      newConvWorkingMemory,
      episodicService,
      eventLogRepository,
    )

    await useCase.execute({ sessionId: 'session_2', avatarId: 'avatar_1' })

    // Step 3: verify continuity — new conversation working memory contains prior episodic content
    const hydratedMemory = await newConvWorkingMemory.findByConversationId('conversation_2')
    expect(hydratedMemory).not.toBeNull()
    expect(hydratedMemory?.summary).toContain('budget')

    // And a hydration event was emitted
    expect(appendEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'memory_hydration_succeeded' }),
    )
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { Conversation, Message, Session } from '../../../domain/conversation/session.types.js'
import type { MemorySelectionService } from '../../services/memory-selection.service.js'
import type { TypedRetrievalService } from '../../services/knowledge/typed-retrieval.service.js'
import { SendMessageUseCase } from './send-message.use-case.js'

const findSessionByIdMock = vi.fn()
const updateSessionMock = vi.fn()
const findConversationByIdMock = vi.fn()
const findAvatarByIdMock = vi.fn()
const findScenarioByIdMock = vi.fn()
const listAvatarsByScenarioIdMock = vi.fn()
const findMessagesByConversationIdMock = vi.fn()
const saveMessageMock = vi.fn()
const completeMock = vi.fn()
const appendEventMock = vi.fn()
const findUserByIdMock = vi.fn()
const retrieveTypedContextMock = vi.fn()

const sessionRepository = {
  findById: findSessionByIdMock,
  create: vi.fn(),
  update: updateSessionMock,
  delete: vi.fn(),
  list: vi.fn(),
  countByScenarioId: vi.fn(),
  countActiveByScenarioId: vi.fn(),
}
const conversationRepository = {
  findById: findConversationByIdMock,
  findActiveBySessionId: vi.fn(),
  create: vi.fn(),
  listBySessionId: vi.fn(),
  deleteBySessionId: vi.fn(),
  update: vi.fn(),
}
const avatarRepository = {
  findById: findAvatarByIdMock,
  create: vi.fn(),
  listByScenarioId: listAvatarsByScenarioIdMock,
  delete: vi.fn(),
  update: vi.fn(),
  saveComputedTraits: vi.fn(),
}
const scenarioRepository = {
  create: vi.fn(),
  findById: findScenarioByIdMock,
  list: vi.fn(),
  delete: vi.fn(),
  update: vi.fn(),
}
const messageRepository = {
  findByConversationId: findMessagesByConversationIdMock,
  save: saveMessageMock,
  deleteByConversationId: vi.fn(),
}
const llm = { complete: completeMock }
const eventLogRepository = { append: appendEventMock, findBySessionId: vi.fn() }
const userRepository = { findById: findUserByIdMock, upsert: vi.fn() }

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    activeAvatarId: 'avatar_1',
    status: 'active',
    startedAt: '2026-04-18T10:00:00.000Z',
    lastActivityAt: '2026-04-18T10:00:00.000Z',
    ...overrides,
  }
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    conversationId: 'conversation_1',
    sessionId: 'session_1',
    avatarId: 'avatar_1',
    status: 'active',
    startedAt: '2026-04-18T10:00:00.000Z',
    lastActivityAt: '2026-04-18T10:00:00.000Z',
    ...overrides,
  }
}

function makeAvatar(overrides: Partial<AvatarConfig> = {}): AvatarConfig {
  return {
    avatarId: 'avatar_1',
    scenarioId: 'scenario_1',
    name: 'Ava',
    status: 'active',
    personaPrompt: 'You are Ava.',
    config: {},
    createdAt: '2026-04-20T10:00:00.000Z',
    updatedAt: '2026-04-20T10:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  findSessionByIdMock.mockReset()
  updateSessionMock.mockReset()
  findConversationByIdMock.mockReset()
  findAvatarByIdMock.mockReset()
  findScenarioByIdMock.mockReset()
  listAvatarsByScenarioIdMock.mockReset()
  findMessagesByConversationIdMock.mockReset()
  saveMessageMock.mockReset()
  completeMock.mockReset()
  appendEventMock.mockReset()
  findUserByIdMock.mockReset()
  retrieveTypedContextMock.mockReset()

  findSessionByIdMock.mockResolvedValue(makeSession())
  updateSessionMock.mockResolvedValue(makeSession())
  findConversationByIdMock.mockResolvedValue(makeConversation())
  findAvatarByIdMock.mockResolvedValue(makeAvatar())
  findScenarioByIdMock.mockResolvedValue({
    scenarioId: 'scenario_1',
    name: 'Scenario',
    status: 'active',
    objectives: [],
    worldContext: '',
    avatarAvailability: { initialAvatarIds: [] },
    config: {},
    createdAt: '2026-04-18T10:00:00.000Z',
    updatedAt: '2026-04-18T10:00:00.000Z',
  })
  listAvatarsByScenarioIdMock.mockResolvedValue([makeAvatar()])
  findMessagesByConversationIdMock.mockResolvedValue([])
  saveMessageMock.mockImplementation((message: Message) => Promise.resolve(message))
  completeMock.mockResolvedValue({
    content: 'Avatar reply',
    model: 'null-model',
    inputTokens: 10,
    outputTokens: 20,
    latencyMs: 5,
  })
  appendEventMock.mockResolvedValue(undefined)
  findUserByIdMock.mockResolvedValue(null)
  retrieveTypedContextMock.mockResolvedValue({
    memory: [],
    world: [],
    media: [],
    trace: {
      query: 'q',
      perType: {
        memory: { sourceIds: [], selectedChunkIds: [] },
        world: { sourceIds: [], selectedChunkIds: [] },
        media: { sourceIds: [], selectedChunkIds: [] },
      },
    },
  })
})

describe('SendMessageUseCase typed retrieval query reuse', () => {
  it('reuses prompt-context inputs for retrieval instead of reloading conversation for a retrieval query', async () => {
    const memorySelectionService = {
      select: vi.fn().mockResolvedValue({
        shortTermExchanges: [
          { user: 'The tide is shifting.', avatar: 'Then watch the harbor markers.' },
        ],
        workingMemory: {
          summary: 'The user wants concise docking advice.',
          unresolvedThreads: [],
          updatedAt: '2026-05-06T10:00:00.000Z',
          selectionReasons: ['working_memory', 'continuity'],
        },
        episodicMemories: [],
        longTermFacts: [],
      }),
      toAvatarMemorySnapshot: vi.fn().mockReturnValue({
        shortTerm: {
          exchangeCount: 2,
          recentExchanges: [
            { user: 'The tide is shifting.', avatar: 'Then watch the harbor markers.' },
          ],
        },
        working: {
          session: {
            summary: 'The user wants concise docking advice.',
            updatedAt: '2026-05-06T10:00:00.000Z',
          },
        },
      }),
    }
    const useCase = new SendMessageUseCase(
      sessionRepository,
      conversationRepository,
      avatarRepository,
      scenarioRepository,
      messageRepository,
      llm,
      eventLogRepository,
      null,
      userRepository,
      null,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      memorySelectionService as unknown as MemorySelectionService,
      { retrieve: retrieveTypedContextMock } as unknown as TypedRetrievalService,
    )
    findSessionByIdMock.mockResolvedValue(
      makeSession({ gmNotes: 'Keep the answer focused on docking safety.' }),
    )

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'What should I do?' })

    expect(retrieveTypedContextMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        scenarioId: 'scenario_1',
        sessionId: 'session_1',
        userId: 'user_1',
        conversationId: 'conversation_1',
        activeAvatarId: 'avatar_1',
        query:
          'Keep the answer focused on docking safety. | What should I do? | The user wants concise docking advice. User: The tide is shifting. Avatar: Then watch the harbor markers.',
        queries: [
          {
            source: 'gm_guideline',
            text: 'Keep the answer focused on docking safety.',
          },
          {
            source: 'last_user_input',
            text: 'What should I do?',
          },
          {
            source: 'working_memory',
            text: 'The user wants concise docking advice. User: The tide is shifting. Avatar: Then watch the harbor markers.',
          },
        ],
        limitPerType: 7,
      }),
    )
    expect(retrieveTypedContextMock).toHaveBeenCalledTimes(1)
    expect(findMessagesByConversationIdMock).not.toHaveBeenCalledWith('conversation_1', {
      limit: 12,
    })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { Conversation, Message, Session } from '../../../domain/conversation/session.types.js'
import { SendMessageUseCase } from './send-message.use-case.js'

const findSessionByIdMock = vi.fn()
const updateSessionMock = vi.fn()
const findConversationByIdMock = vi.fn()
const updateConversationMock = vi.fn()
const findAvatarByIdMock = vi.fn()
const findScenarioByIdMock = vi.fn()
const listAvatarsByScenarioIdMock = vi.fn()
const findMessagesByConversationIdMock = vi.fn()
const saveMessageMock = vi.fn()
const completeMock = vi.fn()
const appendEventMock = vi.fn()
const findUserByIdMock = vi.fn()

const sessionRepository = {
  findById: findSessionByIdMock,
  update: updateSessionMock,
} as const

const conversationRepository = {
  findById: findConversationByIdMock,
  update: updateConversationMock,
} as const

const avatarRepository = {
  findById: findAvatarByIdMock,
  listByScenarioId: listAvatarsByScenarioIdMock,
} as const

const scenarioRepository = {
  findById: findScenarioByIdMock,
} as const

const messageRepository = {
  findByConversationId: findMessagesByConversationIdMock,
  save: saveMessageMock,
} as const

const llm = { complete: completeMock }
const eventLogRepository = { append: appendEventMock }
const userRepository = { findById: findUserByIdMock }

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
  findSessionByIdMock.mockResolvedValue(makeSession())
  updateSessionMock.mockResolvedValue(makeSession())
  findConversationByIdMock.mockResolvedValue(makeConversation())
  updateConversationMock.mockResolvedValue(makeConversation())
  findAvatarByIdMock.mockResolvedValue(makeAvatar())
  listAvatarsByScenarioIdMock.mockResolvedValue([makeAvatar()])
  findScenarioByIdMock.mockResolvedValue({
    scenarioId: 'scenario_1',
    name: 'Scenario',
    status: 'active',
    config: {},
    createdAt: '2026-04-18T10:00:00.000Z',
    updatedAt: '2026-04-18T10:00:00.000Z',
  })
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
})

describe('SendMessageUseCase — context assembler dependency', () => {
  it('uses injected context assembler output for prompt context', async () => {
    const assembleMock = vi.fn().mockReturnValue({
      avatar: {
        avatarId: 'avatar_1',
        recentExchanges: [],
        workingMemory: {},
        longTermFacts: [],
        userPersona: null,
        gmNotes: 'Injected directive',
        scenario: {
          scenarioId: 'scenario_1',
          name: 'Scenario',
        },
      },
      gm: {
        recentMessages: [],
        memory: {},
        currentState: {
          progression: '',
          topicsCovered: [],
          interactionCount: 0,
        },
        availableAvatars: [{ avatarId: 'avatar_1', name: 'Ava', availability: 'available' }],
        userPersona: null,
        scenario: {
          scenarioId: 'scenario_1',
          name: 'Scenario',
        },
      },
      trace: {
        deterministic: true,
        policy: {
          tokenBudget: { avatarMaxTokens: 800, gmMaxTokens: 900 },
          protectedSegments: ['gmDirective', 'scenario'],
          precedence: [
            'gmDirective',
            'scenario',
            'userPersona',
            'shortTermMemory',
            'workingMemory',
            'longTermFacts',
            'typedRetrievalMemory',
            'typedRetrievalWorld',
            'typedRetrievalMedia',
            'recentMessages',
          ],
        },
        selectedInputs: {
          hasActiveAvatar: true,
          recentMessageCount: 1,
          shortTermExchangeCount: 0,
          hasWorkingMemory: false,
          longTermFactCount: 0,
          retrievalCounts: { memory: 0, world: 0, media: 0 },
          hasUserPersona: false,
          hasGmDirective: true,
        },
        rationale: {
          avatarProjection: [],
          gmProjection: [],
        },
        selection: {
          kept: [],
          trimmed: [],
        },
      },
    })

    const useCase = new SendMessageUseCase(
      sessionRepository as never,
      conversationRepository as never,
      avatarRepository as never,
      scenarioRepository as never,
      messageRepository as never,
      llm,
      eventLogRepository as never,
      null,
      userRepository as never,
      null,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { assemble: assembleMock },
    )

    await useCase.execute({ conversationId: 'conversation_1', userMessage: 'Hello' })

    expect(assembleMock).toHaveBeenCalledTimes(1)
    const llmRequest = completeMock.mock.calls[0]?.[0] as { systemPrompt: string }
    expect(llmRequest.systemPrompt).toContain('## Director Notes')
    expect(llmRequest.systemPrompt).toContain('Injected directive')
  })
})

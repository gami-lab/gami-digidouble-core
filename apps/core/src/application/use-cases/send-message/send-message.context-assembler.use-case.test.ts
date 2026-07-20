import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { AvatarComputedTraits } from '@gami/shared'
import type { Conversation, Message, Session } from '../../../domain/conversation/session.types.js'
import type { ContextEngineOutput } from '../../../domain/context/context-engine.types.js'
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
const SAMPLE_TRAITS: AvatarComputedTraits = {
  identity: ['Archivist of the north wing'],
  personality: ['Measured'],
  speakingStyle: ['Short and literal'],
  background: ['Former restorer'],
  timeline: ['Joined after the renovation'],
  currentSituation: ['Guiding late arrivals'],
  behaviouralRules: ['Never reveal sealed exhibits'],
}

function makeAssembledContext(): ContextEngineOutput {
  return {
    avatar: {
      avatarId: 'avatar_1',
      sections: {
        directorNotes: 'Injected directive',
        responseRules: { items: ['Use short paragraphs.'] },
        conversationState: {
          recentExchanges: [],
          workingMemory: {},
          longTermFacts: [],
        },
        userPersona: null,
        worldContext: {
          scenarioId: 'scenario_1',
          name: 'Scenario',
          description: 'Scenario world context',
          goals: ['Find the culprit'],
        },
        avatarTraits: SAMPLE_TRAITS,
      },
    },
    gm: {
      currentState: {
        progression: '',
        topicsCovered: [],
        interactionCount: 0,
      },
      availableAvatars: [{ avatarId: 'avatar_1', name: 'Ava', availability: 'available' }],
      sections: {
        conversationState: {
          recentMessages: [],
          memory: {},
        },
        userPersona: null,
        worldContext: {
          scenarioId: 'scenario_1',
          name: 'Scenario',
        },
      },
    },
    trace: {
      deterministic: true,
      policy: {
        tokenBudget: { avatarMaxTokens: 800, gmMaxTokens: 900 },
        sectionPrecedence: [
          'directorNotes',
          'responseRules',
          'conversationState',
          'userPersona',
          'worldContext',
          'retrievedContext',
          'avatarTraits',
        ],
        protectedSegments: ['directorNotes', 'responseRules', 'worldContext'],
        precedence: [
          'directorNotes',
          'responseRules',
          'conversationStateWorkingMemory',
          'conversationStateLongTermFacts',
          'conversationStateRecentExchanges',
          'conversationStateRecentMessages',
          'userPersona',
          'worldContext',
          'retrievedContextMemory',
          'retrievedContextWorld',
          'retrievedContextMedia',
          'avatarTraits',
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
        responseRuleCount: 1,
        hasAvatarTraits: true,
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
  }
}

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

function createUseCase(assembleMock: ReturnType<typeof vi.fn>): SendMessageUseCase {
  return new SendMessageUseCase(
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
}

function readSystemPrompt(): string {
  return (completeMock.mock.calls[0]?.[0] as { systemPrompt: string }).systemPrompt
}

async function executeWithContext(
  assembleMock: ReturnType<typeof vi.fn>,
  avatarOverrides?: Partial<AvatarConfig>,
): Promise<string> {
  if (avatarOverrides !== undefined) {
    findAvatarByIdMock.mockResolvedValue(makeAvatar(avatarOverrides))
  }

  await createUseCase(assembleMock).execute({
    conversationId: 'conversation_1',
    userMessage: 'Hello',
  })

  return readSystemPrompt()
}

function expectStructuredPromptSections(systemPrompt: string): void {
  expect(systemPrompt).toContain('## Director Notes')
  expect(systemPrompt).toContain('Injected directive')
  expect(systemPrompt).toContain('Use short paragraphs.')
  expect(systemPrompt).toContain('## World Context')
  expect(systemPrompt).toContain('Scenario: Scenario')
  expect(systemPrompt).toContain('Objectives:')
  expect(systemPrompt).toContain('- Find the culprit')
  expect(systemPrompt).toContain('## Avatar Traits')
  expect(systemPrompt).toContain('- Archivist of the north wing')
}

beforeEach(() => {
  findSessionByIdMock.mockReset()
  updateSessionMock.mockReset()
  findConversationByIdMock.mockReset()
  updateConversationMock.mockReset()
  findAvatarByIdMock.mockReset()
  findScenarioByIdMock.mockReset()
  listAvatarsByScenarioIdMock.mockReset()
  findMessagesByConversationIdMock.mockReset()
  saveMessageMock.mockReset()
  completeMock.mockReset()
  appendEventMock.mockReset()
  findUserByIdMock.mockReset()

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
    objectives: [],
    worldContext: '',
    avatarAvailability: { initialAvatarIds: [] },
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
    const assembleMock = vi.fn().mockReturnValue(makeAssembledContext())
    const systemPrompt = await executeWithContext(assembleMock)

    expect(assembleMock).toHaveBeenCalledTimes(1)
    expectStructuredPromptSections(systemPrompt)
  })

  it('respects selected avatar traits instead of raw avatar config when prepared traits are present', async () => {
    const assembleMock = vi.fn().mockReturnValue(makeAssembledContext())
    const systemPrompt = await executeWithContext(assembleMock, {
      personaPrompt: 'Legacy authored persona that should not appear.',
      adjustments: ['Legacy rule that should not appear.'],
      computedTraits: {
        ...SAMPLE_TRAITS,
        identity: ['Raw config trait that should not appear'],
      },
    })

    expect(systemPrompt).toContain('- Archivist of the north wing')
    expect(systemPrompt).not.toContain('Raw config trait that should not appear')
    expect(systemPrompt).not.toContain('Legacy authored persona that should not appear.')
    expect(systemPrompt).not.toContain('Legacy rule that should not appear.')
  })

  it('falls back to the authored personaPrompt when the avatar has no computed traits', async () => {
    const contextWithoutTraits = makeAssembledContext()
    delete contextWithoutTraits.avatar.sections.avatarTraits
    contextWithoutTraits.trace.selectedInputs.hasAvatarTraits = false
    const assembleMock = vi.fn().mockReturnValue(contextWithoutTraits)
    const systemPrompt = await executeWithContext(assembleMock, {
      personaPrompt: 'You are Ava, a careful guide.',
    })

    expect(systemPrompt).toContain('You are Ava, a careful guide.')
  })
})

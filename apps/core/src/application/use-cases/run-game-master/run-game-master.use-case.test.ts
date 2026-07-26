/* eslint-disable max-lines */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeEvent } from '@gami/shared'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'
import type { GameMasterState } from '../../../domain/game-master/game-master.types.js'
import { GAME_MASTER_SYSTEM_PROMPT_VERSION } from '../../../domain/game-master/gm-prompt.service.js'
import { GAME_MASTER_INPUT_RENDERER_VERSION } from '../../../domain/game-master/gm-input-renderer.js'
import { expectConsoleError } from '../../../test-utils/console.js'
import { readRenderedGameMasterPrompt } from '../../../test-utils/game-master.js'
import { LlmError } from '../../../infrastructure/llm/llm.error.js'
import { InMemoryEventLogRepository } from '../../../infrastructure/db/in-memory-event-log.repository.js'
import { RunGameMasterUseCase } from './run-game-master.use-case.js'

const findBySessionIdMock = vi.fn()
const saveGmStateMock = vi.fn()
const findSessionByIdMock = vi.fn()
const updateSessionMock = vi.fn()
const listAvatarsByScenarioIdMock = vi.fn()
const completeMock = vi.fn()
const traceMock = vi.fn()
const findScenarioByIdMock = vi.fn()
const findMessagesByConversationIdMock = vi.fn()
const eventPublisherEmitMock = vi.fn()
const eventPublisherSetProcessingMock = vi.fn()

const gmStateRepository = { findBySessionId: findBySessionIdMock, save: saveGmStateMock }
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
  findById: vi.fn(),
  create: vi.fn(),
  listByScenarioId: listAvatarsByScenarioIdMock,
  delete: vi.fn(),
  update: vi.fn(),
  saveComputedTraits: vi.fn(),
}
const scenarioRepository = {
  findById: findScenarioByIdMock,
  create: vi.fn(),
  list: vi.fn(),
  delete: vi.fn(),
  update: vi.fn(),
}
const llm = { complete: completeMock }
const observability = { trace: traceMock, flush: vi.fn() }
const messageRepository = {
  create: vi.fn(),
  save: vi.fn(),
  findByConversationId: findMessagesByConversationIdMock,
  findById: vi.fn(),
  deleteByConversationId: vi.fn(),
}
const sessionEventPublisher = {
  emit: eventPublisherEmitMock,
  subscribe: vi.fn(),
  getLastEvent: vi.fn(),
  isProcessing: vi.fn(() => false),
  setProcessing: eventPublisherSetProcessingMock,
}

function makeState(overrides: Partial<GameMasterState> = {}): GameMasterState {
  return {
    progression: 'progressing',
    topicsCovered: ['plastic'],
    interactionCount: 1,
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

function createUseCase(params?: {
  eventLog?: InMemoryEventLogRepository
  withPublisher?: boolean
}): RunGameMasterUseCase {
  return new RunGameMasterUseCase(
    gmStateRepository,
    sessionRepository,
    avatarRepository,
    llm,
    observability,
    scenarioRepository,
    params?.eventLog,
    undefined,
    messageRepository,
    params?.withPublisher === false ? undefined : sessionEventPublisher,
  )
}

function runtimeEvents(): RuntimeEvent[] {
  return eventPublisherEmitMock.mock.calls.map((call) => call[0] as RuntimeEvent)
}

beforeEach(() => {
  findBySessionIdMock.mockReset()
  saveGmStateMock.mockReset()
  findSessionByIdMock.mockReset()
  updateSessionMock.mockReset()
  listAvatarsByScenarioIdMock.mockReset()
  completeMock.mockReset()
  traceMock.mockReset()
  findScenarioByIdMock.mockReset()
  findMessagesByConversationIdMock.mockReset()
  eventPublisherEmitMock.mockReset()
  eventPublisherSetProcessingMock.mockReset()

  findBySessionIdMock.mockResolvedValue(makeState())
  saveGmStateMock.mockResolvedValue(undefined)
  findSessionByIdMock.mockResolvedValue({
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    activeAvatarId: 'avatar_1',
    status: 'active',
    startedAt: '2026-04-18T10:00:00.000Z',
    lastActivityAt: '2026-04-18T10:00:00.000Z',
  })
  updateSessionMock.mockResolvedValue(undefined)
  listAvatarsByScenarioIdMock.mockResolvedValue([makeAvatar()])
  findScenarioByIdMock.mockResolvedValue({
    scenarioId: 'scenario_1',
    name: 'Scenario',
    status: 'active',
    objectives: ['Understand the basics.'],
    worldContext: 'A learning world.',
    avatarAvailability: { initialAvatarIds: [] },
    config: {
      goals: ['Ask better questions.'],
    },
    createdAt: '2026-04-18T10:00:00.000Z',
    updatedAt: '2026-04-18T10:00:00.000Z',
  })
  completeMock.mockResolvedValue({
    content: JSON.stringify({
      dialogueControl: { mode: 'avatar_guided', askFollowUp: false },
      retrievalPlan: { required: false },
      directorNotes: 'Help the user move to concrete examples.',
      progressionUpdate: { progression: 'increase' },
    }),
    model: 'null-model',
    inputTokens: 10,
    outputTokens: 20,
    latencyMs: 4,
  })
  traceMock.mockResolvedValue(undefined)
  findMessagesByConversationIdMock.mockResolvedValue([])
})

describe('RunGameMasterUseCase — state persistence', () => {
  it('calls the GM LLM after every turn and persists reduced state', async () => {
    const useCase = createUseCase()

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 2,
      correlationId: 'request_1',
    })

    expect(completeMock).toHaveBeenCalledTimes(1)
    expect(saveGmStateMock).toHaveBeenCalledWith(
      'session_1',
      expect.objectContaining({
        interactionCount: 1,
        topicsCovered: ['plastic'],
      }),
    )
    expect(updateSessionMock).toHaveBeenCalledWith('session_1', {
      gmNotes: 'Help the user move to concrete examples.',
    })
  })
})

describe('RunGameMasterUseCase — prompt request content', () => {
  it('renders scenario goals and avatar availability into structured GM prompt content', async () => {
    const useCase = createUseCase()

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 2,
      correlationId: 'request_2',
    })

    const request = completeMock.mock.calls[0]?.[0] as { messages: Array<{ content: string }> }
    const prompt = readRenderedGameMasterPrompt(request)
    expectSectionOrder(prompt, [
      '## Current Turn',
      '## Current Discussion Context',
      '## Experience Context',
      '## Output Reminder',
    ])
    expect(prompt).toContain('### Scenario')
    expect(prompt).toContain('- Goal 1: Understand the basics.')
    expect(prompt).toContain('- Goal 2: Ask better questions.')
    expect(prompt).toContain('### Available Avatars')
    expect(prompt).toContain('- Ava (avatar_1)')
  })
})

describe('RunGameMasterUseCase — refined prompt path', () => {
  it('sends the refined GM system prompt and structured rendered context through llm.complete', async () => {
    const useCase = createUseCase()

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 2,
      correlationId: 'request_prompt_path',
    })

    const request = completeMock.mock.calls[0]?.[0] as {
      systemPrompt: string
      messages: Array<{ content: string }>
      trace: { metadata: Record<string, unknown> }
    }
    const prompt = readRenderedGameMasterPrompt(request)

    expectSectionOrder(request.systemPrompt, [
      '## Role',
      '## Responsibilities',
      '## Fact Discipline',
      '## Decision Policies',
      '## Output Contract',
    ])
    expect(request.systemPrompt).toContain('Output ONLY a valid JSON object.')
    expect(request.systemPrompt).toContain(
      '- askFollowUp must always be stated explicitly; never infer it from mode alone.',
    )
    expect(prompt).toContain('## Current Turn')
    expect(prompt).toContain('## Current Discussion Context')
    expect(prompt).toContain('## Experience Context')
    expect(prompt).toContain('## Output Reminder')
    expect(request.trace.metadata).toMatchObject({
      gmSystemPromptVersion: GAME_MASTER_SYSTEM_PROMPT_VERSION,
      gmInputRendererVersion: GAME_MASTER_INPUT_RENDERER_VERSION,
    })
  })
})

describe('RunGameMasterUseCase — optional and session-start prompt content', () => {
  it('renders userPersona in the current discussion context when provided', async () => {
    const useCase = createUseCase()

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 2,
      correlationId: 'request_persona',
      userPersona: { name: 'Lina', roleInWorld: 'friend' },
    })

    const request = completeMock.mock.calls[0]?.[0] as { messages: Array<{ content: string }> }
    const prompt = readRenderedGameMasterPrompt(request)
    expect(prompt).toContain('### User Persona')
    expect(prompt).toContain('- Name: Lina')
    expect(prompt).toContain('- Role In World: friend')
  })

  it('does not inject empty userPersona when input has none', async () => {
    const useCase = createUseCase()

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 2,
      correlationId: 'request_no_persona',
    })

    const request = completeMock.mock.calls[0]?.[0] as { messages: Array<{ content: string }> }
    const prompt = readRenderedGameMasterPrompt(request)
    expect(prompt).not.toContain('### User Persona')
  })

  it('surfaces the latest avatar reply explicitly in the current-turn section when recent exchanges exist', async () => {
    const useCase = createUseCase()
    findMessagesByConversationIdMock.mockResolvedValue([
      {
        messageId: 'message_1',
        conversationId: 'conversation_1',
        role: 'user',
        content: 'How can we stabilize the cleanup plan?',
        createdAt: '2026-04-18T10:00:00.000Z',
      },
      {
        messageId: 'message_2',
        conversationId: 'conversation_1',
        role: 'avatar',
        content: 'Start with concrete examples from the harbor schedule.',
        createdAt: '2026-04-18T10:00:01.000Z',
      },
    ])

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      conversationId: 'conversation_1',
      userMessageText: 'hello',
      turnIndex: 2,
      correlationId: 'request_latest_exchange',
    })

    const request = completeMock.mock.calls[0]?.[0] as { messages: Array<{ content: string }> }
    const prompt = readRenderedGameMasterPrompt(request)
    expect(prompt).toContain(
      '- Latest Avatar Reply: Start with concrete examples from the harbor schedule.',
    )
  })

  it('preserves session-start guidance when userMessage.text is empty', async () => {
    const useCase = createUseCase()

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: '',
      turnIndex: 0,
      correlationId: 'request_session_start',
    })

    const request = completeMock.mock.calls[0]?.[0] as {
      systemPrompt: string
      messages: Array<{ content: string }>
    }
    const prompt = readRenderedGameMasterPrompt(request)

    expect(request.systemPrompt).toContain(
      'When userMessage.text is empty, no user message has been sent yet. Treat this as conversation opening guidance, and use directorNotes to tell the Avatar how to open instead of reacting to a message.',
    )
    expect(prompt).toContain(
      '- Latest User Message: [none - session start; provide opening guidance for the Avatar].',
    )
  })
})

describe('RunGameMasterUseCase — event log', () => {
  it('emits gm_triggered with post-turn reason and safe decision fields', async () => {
    const eventLog = new InMemoryEventLogRepository()
    const useCase = createUseCase({ eventLog })

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'secret user input',
      turnIndex: 2,
      correlationId: 'corr_xyz',
    })

    const event = expectDefined(eventLog.getAll()[0])
    const payload = event.payload
    const payloadJson = JSON.stringify(payload)

    expect(event.type).toBe('gm_triggered')
    expect(payload['triggerReason']).toBe('post_turn_observation')
    expect(payload['decision']).toBeDefined()
    expect(payload['decision']).toMatchObject({
      injectedNote: 'Help the user move to concrete examples.',
    })
    expect(payload['gmContext']).toMatchObject({
      currentState: {
        progression: 'progressing',
        interactionCount: 1,
      },
      sections: {
        conversationState: {
          recentMessages: [],
        },
      },
    })
    expect(payloadJson).not.toContain('secret user input')
    expect(payloadJson).not.toContain('systemPrompt')
    expect(payloadJson).not.toContain('## Current Turn')
    expect(payloadJson).not.toContain('Output ONLY a valid JSON object.')
  })

  it('enriches gm_triggered payload with latency, token usage, and correlation id', async () => {
    const eventLog = new InMemoryEventLogRepository()
    const useCase = createUseCase({ eventLog })

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 2,
      correlationId: 'corr_metric',
    })

    const event = eventLog.getAll()[0]
    expect(typeof event?.payload['latencyMs']).toBe('number')
    expect(event?.payload['inputTokens']).toBe(10)
    expect(event?.payload['outputTokens']).toBe(20)
    expect(event?.payload['correlationId']).toBe('corr_metric')
  })
})

describe('RunGameMasterUseCase — runtime event publication lifecycle', () => {
  it('runs without publisher dependency', async () => {
    const useCase = createUseCase({ withPublisher: false })

    await expect(
      useCase.execute({
        sessionId: 'session_1',
        scenarioId: 'scenario_1',
        avatarId: 'avatar_1',
        userMessageText: 'hello',
        turnIndex: 2,
        correlationId: 'no_publisher',
      }),
    ).resolves.toBeUndefined()
  })

  it('emits processing_started and processing_finished and toggles processing state', async () => {
    const useCase = createUseCase()

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      avatarId: 'avatar_1',
      userMessageText: 'hello',
      turnIndex: 2,
      correlationId: 'processing_1',
    })

    expect(eventPublisherSetProcessingMock).toHaveBeenNthCalledWith(1, 'session_1', true)
    expect(eventPublisherSetProcessingMock).toHaveBeenLastCalledWith('session_1', false)
    expect(runtimeEvents().some((event) => event.type === 'runtime.processing_started')).toBe(true)
    expect(runtimeEvents().some((event) => event.type === 'runtime.processing_finished')).toBe(true)
  })

  it('emits processing_finished on error path with success false', async () => {
    const useCase = createUseCase()
    listAvatarsByScenarioIdMock.mockRejectedValue(new Error('avatar list failed'))

    await expect(
      useCase.execute({
        sessionId: 'session_1',
        scenarioId: 'scenario_1',
        avatarId: 'avatar_1',
        userMessageText: 'hello',
        turnIndex: 2,
        correlationId: 'processing_error',
      }),
    ).rejects.toThrow('avatar list failed')

    const finished = runtimeEvents().find((event) => event.type === 'runtime.processing_finished')
    expect(finished).toBeDefined()
    expect(finished?.payload).toEqual({ success: false })
    expect(eventPublisherSetProcessingMock).toHaveBeenLastCalledWith('session_1', false)
  })
})

function expectSectionOrder(prompt: string, sections: string[]): void {
  let previousIndex = -1

  for (const section of sections) {
    const index = prompt.indexOf(section)
    expect(index).toBeGreaterThan(previousIndex)
    previousIndex = index
  }
}

function expectDefined<T>(value: T | undefined): T {
  expect(value).toBeDefined()
  return value as T
}

describe('RunGameMasterUseCase — runtime event publication unlocks', () => {
  it('emits runtime.avatar_unlocked when unlocks are produced', async () => {
    const useCase = createUseCase()
    listAvatarsByScenarioIdMock.mockResolvedValue([
      makeAvatar({ avatarId: 'avatar_1', name: 'Ava' }),
      makeAvatar({ avatarId: 'avatar_2', name: 'Theo' }),
    ])
    findSessionByIdMock.mockResolvedValue({
      sessionId: 'session_1',
      userId: 'user_1',
      scenarioId: 'scenario_1',
      activeAvatarId: 'avatar_1',
      unlockedAvatarIds: ['avatar_1'],
      status: 'active',
      startedAt: '2026-04-18T10:00:00.000Z',
      lastActivityAt: '2026-04-18T10:00:00.000Z',
    })
    completeMock.mockResolvedValue({
      content: JSON.stringify({
        dialogueControl: { mode: 'avatar_guided', askFollowUp: false },
        retrievalPlan: { required: false },
        routing: { action: 'unlock', avatarId: 'avatar_2', reason: 'Theo can help' },
        progressionUpdate: { progression: 'increase' },
      }),
      model: 'null-model',
      inputTokens: 10,
      outputTokens: 20,
      latencyMs: 4,
    })
    findMessagesByConversationIdMock.mockResolvedValue([
      {
        messageId: 'msg_1',
        conversationId: 'conversation_1',
        role: 'user',
        content: 'Can Theo help here?',
        createdAt: '2026-04-18T10:00:00.000Z',
      },
      {
        messageId: 'msg_2',
        conversationId: 'conversation_1',
        role: 'avatar',
        content: 'Theo can probably help.',
        createdAt: '2026-04-18T10:00:01.000Z',
      },
    ])

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      userMessageText: 'unlock someone',
      turnIndex: 2,
      correlationId: 'unlock_1',
    })

    const unlocked = runtimeEvents().find((event) => event.type === 'runtime.avatar_unlocked')
    expect(unlocked?.payload).toEqual({ unlockedAvatarIds: ['avatar_2'] })
  })

  it('does not emit runtime.avatar_unlocked when no unlocks are produced', async () => {
    const useCase = createUseCase()

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      userMessageText: 'no unlock',
      turnIndex: 2,
      correlationId: 'unlock_0',
    })

    expect(runtimeEvents().some((event) => event.type === 'runtime.avatar_unlocked')).toBe(false)
  })
})

describe('RunGameMasterUseCase — runtime event publication guidance', () => {
  it('emits runtime.avatar_suggested when suggestedAvatarId is present', async () => {
    const useCase = createUseCase()
    listAvatarsByScenarioIdMock.mockResolvedValue([
      makeAvatar({ avatarId: 'avatar_1', name: 'Ava' }),
      makeAvatar({ avatarId: 'avatar_2', name: 'Theo' }),
    ])
    completeMock.mockResolvedValue({
      content: JSON.stringify({
        dialogueControl: { mode: 'avatar_guided', askFollowUp: false },
        retrievalPlan: { required: false },
        routing: { action: 'suggest', avatarId: 'avatar_2', reason: 'Better context' },
        progressionUpdate: { progression: 'increase' },
      }),
      model: 'null-model',
      inputTokens: 10,
      outputTokens: 20,
      latencyMs: 4,
    })

    await useCase.execute({
      sessionId: 'session_1',
      scenarioId: 'scenario_1',
      conversationId: 'conversation_1',
      avatarId: 'avatar_1',
      userMessageText: 'suggest',
      turnIndex: 2,
      correlationId: 'suggest_1',
    })

    const suggested = runtimeEvents().find((event) => event.type === 'runtime.avatar_suggested')
    expect(suggested?.payload).toEqual({
      suggestedAvatarId: 'avatar_2',
      reason: 'Better context',
    })
  })
})

describe('RunGameMasterUseCase — error handling', () => {
  it('does not propagate LlmError or change interaction count, and emits gm_error', async () => {
    const eventLog = new InMemoryEventLogRepository()
    const useCase = createUseCase({ eventLog })
    completeMock.mockRejectedValue(new LlmError('null', 'provider down', 503))

    await expectConsoleError(
      () =>
        useCase.execute({
          sessionId: 'session_1',
          scenarioId: 'scenario_1',
          avatarId: 'avatar_1',
          userMessageText: 'hello',
          turnIndex: 2,
          correlationId: 'corr_err',
        }),
      /\[GM\] LLM call failed:/,
    )

    expect(saveGmStateMock).not.toHaveBeenCalled()
    expect(eventLog.getAll()[0]?.type).toBe('gm_error')
    expect(eventLog.getAll()[0]?.payload['errorCode']).toBe('llm_error')
  })
})

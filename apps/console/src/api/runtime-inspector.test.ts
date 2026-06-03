import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getSessionContext,
  getRuntimeState,
  getSessionMemory,
  getSessionMemoryLayers,
  getSessionMetrics,
  getUserPersona,
  inspectSession,
  listSessionEvents,
} from './sessions'
import { loadRuntimeInspectorViewModel } from './runtime-inspector'

vi.mock('./sessions', () => ({
  inspectSession: vi.fn(),
  getRuntimeState: vi.fn(),
  getSessionContext: vi.fn(),
  getSessionMemory: vi.fn(),
  getSessionMemoryLayers: vi.fn(),
  getSessionMetrics: vi.fn(),
  getUserPersona: vi.fn(),
  listSessionEvents: vi.fn(),
}))

describe('loadRuntimeInspectorViewModel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('composes one bounded runtime inspector model from existing read APIs', async () => {
    arrangeSession1()

    const result = await loadRuntimeInspectorViewModel('session_1', { eventsLimit: 12 })

    expect(inspectSession).toHaveBeenCalledWith('session_1')
    expect(getRuntimeState).toHaveBeenCalledWith('session_1')
    expect(getSessionContext).toHaveBeenCalledWith('session_1')
    expect(getSessionMemory).toHaveBeenCalledWith('session_1')
    expect(getSessionMemoryLayers).toHaveBeenCalledWith('session_1')
    expect(getSessionMetrics).toHaveBeenCalledWith('session_1')
    expect(getUserPersona).toHaveBeenCalledWith('user_1')
    expect(listSessionEvents).toHaveBeenCalledWith('session_1', { limit: 12 })
    expect(result.session.sessionId).toBe('session_1')
    expect(result.gm.gmState).toBeNull()
    expect(result.memory.layers.shortTerm.exchangeCount).toBe(2)
    expect(result.metrics.summary.totalTurns).toBe(1)
    expect(result.metrics.turns).toHaveLength(1)
    expect(result.context.gm.currentState.progression).toBe('intro')
    expect(result.context.trace?.deterministic).toBe(true)
    expect(result.persona?.name).toBe('Maya')
    expect(result.effectiveModels.avatar.provider).toBe('openai')
  })

  it('uses default event limit and preserves optional null layers', async () => {
    arrangeSession2()

    const result = await loadRuntimeInspectorViewModel('session_2')

    expect(listSessionEvents).toHaveBeenCalledWith('session_2', { limit: 20 })
    expect(result.persona).toBeNull()
    expect(result.gm.gmNotes).toBe('n')
    expect(result.runtimeState.isProcessing).toBe(true)
  })
})

// eslint-disable-next-line max-lines-per-function
function arrangeSession1(): void {
  vi.mocked(inspectSession).mockResolvedValue({
    inspect: {
      session: {
        sessionId: 'session_1',
        userId: 'user_1',
        scenarioId: 'scenario_1',
        status: 'active',
        startedAt: '2026-05-01T10:00:00.000Z',
        lastActivityAt: '2026-05-01T10:01:00.000Z',
      },
      gmState: null,
      transitionHistory: [],
      unlockedAvatarIds: ['avatar_1'],
      gmNotes: null,
      effectiveModels: {
        avatar: { provider: 'openai', model: 'gpt-4.1-mini' },
        gameMaster: { provider: 'mistral', model: 'mistral-small-latest' },
        memory: { provider: 'xai', model: 'grok-2-mini' },
      },
    },
  })
  vi.mocked(getRuntimeState).mockResolvedValue({
    sessionId: 'session_1',
    canSendMessage: true,
    isProcessing: false,
    updatedAt: '2026-05-01T10:01:00.000Z',
  })
  vi.mocked(getSessionContext).mockResolvedValue({
    sessionId: 'session_1',
    avatarContext: {
      avatarId: 'avatar_1',
      recentExchanges: [],
      workingMemory: {},
      longTermFacts: [],
      userPersona: { name: 'Maya', roleInWorld: 'student' },
      gmNotes: null,
      scenario: { scenarioId: 'scenario_1', name: 'Scenario 1' },
    },
    gmContext: {
      recentMessages: [],
      memory: {},
      currentState: {
        progression: 'intro',
        topicsCovered: [],
        interactionCount: 1,
      },
      availableAvatars: [],
      userPersona: { name: 'Maya', roleInWorld: 'student' },
      scenario: { scenarioId: 'scenario_1', name: 'Scenario 1' },
    },
    contextTrace: {
      deterministic: true,
      policy: {
        tokenBudget: {
          avatarMaxTokens: 1200,
          gmMaxTokens: 900,
        },
        protectedSegments: ['scenario'],
        precedence: ['gmDirective', 'scenario', 'userPersona'],
      },
      selectedInputs: {
        hasActiveAvatar: true,
        recentMessageCount: 2,
        shortTermExchangeCount: 1,
        hasWorkingMemory: true,
        longTermFactCount: 0,
        retrievalCounts: { memory: 1, world: 1, media: 0 },
        hasUserPersona: true,
        hasGmDirective: false,
      },
      rationale: {
        avatarProjection: ['bounded'],
        gmProjection: ['deterministic'],
      },
      selection: {
        kept: [
          { projection: 'avatar', segmentId: 'scenario', tokenEstimate: 44, reason: 'protected' },
        ],
        trimmed: [],
      },
    },
  })
  vi.mocked(getSessionMemory).mockResolvedValue({
    session: {
      sessionId: 'session_1',
      summary: 'short summary',
      updatedAt: '2026-05-01T10:01:00.000Z',
    },
  })
  vi.mocked(getSessionMemoryLayers).mockResolvedValue({
    session: {
      sessionId: 'session_1',
      shortTerm: {
        exchangeCount: 2,
        recentExchanges: [{ user: 'u1', avatar: 'a1' }],
      },
      working: {
        avatars: [],
      },
      longTerm: {
        avatars: [],
        facts: [],
      },
    },
  })
  vi.mocked(getSessionMetrics).mockResolvedValue({
    sessionId: 'session_1',
    checkedAt: '2026-05-01T10:01:00.000Z',
    summary: {
      totalTurns: 1,
      turnsWithGm: 0,
      avgAvatarLatencyMs: 100,
      avgTotalTurnLatencyMs: 120,
      avgInputTokens: 10,
      avgOutputTokens: 12,
      avgGmLatencyMs: null,
    },
    turns: [
      {
        turnIndex: 1,
        correlationId: 'corr_1',
        conversationId: 'conversation_1',
        avatarLatencyMs: 100,
        totalTurnLatencyMs: 120,
        overheadMs: 20,
        inputTokens: 10,
        outputTokens: 12,
        totalTokens: 22,
        model: 'test-model',
        hasGm: false,
      },
    ],
  })
  vi.mocked(getUserPersona).mockResolvedValue({
    persona: { name: 'Maya', roleInWorld: 'student' },
  })
  vi.mocked(listSessionEvents).mockResolvedValue({
    events: [],
  })
}

function arrangeSession2(): void {
  vi.mocked(inspectSession).mockResolvedValue({
    inspect: {
      session: {
        sessionId: 'session_2',
        userId: 'user_2',
        scenarioId: 'scenario_1',
        status: 'active',
        startedAt: '2026-05-01T10:00:00.000Z',
        lastActivityAt: '2026-05-01T10:01:00.000Z',
      },
      gmState: {
        currentAvatarId: 'avatar_1',
        progression: 'intro',
        topicsCovered: [],
        interactionCount: 1,
      },
      transitionHistory: [],
      unlockedAvatarIds: [],
      gmNotes: 'n',
      effectiveModels: {
        avatar: { provider: 'null', model: '' },
        gameMaster: { provider: 'null', model: '' },
        memory: { provider: 'null', model: '' },
      },
    },
  })
  vi.mocked(getRuntimeState).mockResolvedValue({
    sessionId: 'session_2',
    canSendMessage: false,
    isProcessing: true,
    updatedAt: '2026-05-01T10:01:00.000Z',
  })
  vi.mocked(getSessionContext).mockResolvedValue({
    sessionId: 'session_2',
    avatarContext: {
      recentExchanges: [],
      workingMemory: {},
      longTermFacts: [],
      userPersona: null,
      gmNotes: 'n',
      scenario: { scenarioId: 'scenario_1' },
    },
    gmContext: {
      recentMessages: [],
      memory: {},
      currentState: {
        progression: 'intro',
        topicsCovered: [],
        interactionCount: 1,
      },
      availableAvatars: [],
      userPersona: null,
      scenario: { scenarioId: 'scenario_1' },
    },
  })
  vi.mocked(getSessionMemory).mockResolvedValue({
    session: {
      sessionId: 'session_2',
      summary: '',
      updatedAt: '2026-05-01T10:01:00.000Z',
    },
  })
  vi.mocked(getSessionMemoryLayers).mockResolvedValue({
    session: {
      sessionId: 'session_2',
      shortTerm: { exchangeCount: 2, recentExchanges: [] },
      working: { avatars: [] },
      longTerm: { avatars: [], facts: [] },
    },
  })
  vi.mocked(getSessionMetrics).mockResolvedValue({
    sessionId: 'session_2',
    checkedAt: '2026-05-01T10:01:00.000Z',
    summary: {
      totalTurns: 0,
      turnsWithGm: 0,
      avgAvatarLatencyMs: 0,
      avgTotalTurnLatencyMs: 0,
      avgInputTokens: 0,
      avgOutputTokens: 0,
      avgGmLatencyMs: null,
    },
    turns: [],
  })
  vi.mocked(getUserPersona).mockResolvedValue({ persona: null })
  vi.mocked(listSessionEvents).mockResolvedValue({ events: [] })
}

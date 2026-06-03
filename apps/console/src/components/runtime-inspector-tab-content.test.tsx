/* eslint-disable max-lines */
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { RuntimeEvent } from '@gami/shared'
import type { RuntimeInspectorViewModel } from '../api'
import { RuntimeInspectorTabContent, buildPersonaPayload } from './runtime-inspector-tab-content'
import type { MemoryEvolutionSnapshot } from './memory-evolution'

function makeViewModel(): RuntimeInspectorViewModel {
  return {
    session: makeSessionSummary(),
    runtimeState: makeRuntimeState(),
    gm: makeGmSummary(),
    effectiveModels: {
      avatar: { provider: 'openai', model: 'gpt-4.1-mini' },
      gameMaster: { provider: 'mistral', model: 'mistral-small-latest' },
      memory: { provider: 'xai', model: 'grok-2-mini' },
    },
    memory: makeMemorySummary(),
    metrics: makeMetricsSummary(),
    context: makeContextSummary(),
    knowledge: {
      sources: [
        {
          sourceId: 'source_world_all',
          scenarioId: 'scenario_1',
          name: 'Shared clues',
          knowledgeType: 'world',
          format: 'markdown',
          uriOrPath: '/tmp/shared-clues.md',
          status: 'ready',
          createdAt: '2026-05-07T10:00:00.000Z',
        },
        {
          sourceId: 'source_world_avatar_1',
          scenarioId: 'scenario_1',
          name: 'Clara private notes',
          knowledgeType: 'world',
          format: 'markdown',
          uriOrPath: '/tmp/clara-notes.md',
          status: 'ready',
          visibleToAvatarIds: ['avatar_1'],
          createdAt: '2026-05-07T10:00:00.000Z',
        },
        {
          sourceId: 'source_gm_only',
          scenarioId: 'scenario_1',
          name: 'GM truth',
          knowledgeType: 'world',
          format: 'markdown',
          uriOrPath: '/tmp/gm-truth.md',
          status: 'ready',
          visibleToAvatarIds: ['__GM_ONLY__'],
          createdAt: '2026-05-07T10:00:00.000Z',
        },
      ],
    },
    persona: null,
    recentEvents: [makeGmEvent(), makeRecentEvent()],
  }
}

function makeSessionSummary(): RuntimeInspectorViewModel['session'] {
  return {
    sessionId: 'session_1',
    userId: 'user_1',
    scenarioId: 'scenario_1',
    status: 'active',
    startedAt: '2026-05-07T10:00:00.000Z',
    lastActivityAt: '2026-05-07T10:00:00.000Z',
  }
}

function makeRuntimeState(): RuntimeInspectorViewModel['runtimeState'] {
  return {
    sessionId: 'session_1',
    canSendMessage: true,
    isProcessing: false,
    updatedAt: '2026-05-07T10:00:00.000Z',
  }
}

function makeGmSummary(): RuntimeInspectorViewModel['gm'] {
  return {
    gmState: null,
    gmNotes: null,
    transitionHistory: [],
    unlockedAvatarIds: ['avatar_1'],
  }
}

function makeMemorySummary(): RuntimeInspectorViewModel['memory'] {
  return {
    summary: {
      sessionId: 'session_1',
      summary: 'memory',
      updatedAt: '2026-05-07T10:00:00.000Z',
    },
    layers: {
      sessionId: 'session_1',
      activeAvatarId: 'avatar_1',
      activeConversationId: 'conversation_1',
      shortTerm: {
        exchangeCount: 2,
        recentExchanges: [{ user: 'u', avatar: 'a' }],
      },
      working: {
        current: {
          conversationId: 'conversation_1',
          avatarId: 'avatar_1',
          summary: 'active working summary',
          unresolvedThreads: ['follow_up'],
          candidateFacts: [{ category: 'goal', key: 'focus', value: 'quality' }],
          updatedAt: '2026-05-07T10:00:00.000Z',
        },
        session: {
          summary: 'session summary',
          updatedAt: '2026-05-07T10:00:00.000Z',
        },
        avatars: [
          {
            avatarId: 'avatar_1',
            summary: 'active working summary',
            updatedAt: '2026-05-07T10:00:00.000Z',
          },
        ],
      },
      longTerm: {
        avatars: [
          {
            avatarId: 'avatar_1',
            memories: [
              {
                conversationId: 'conversation_old_1',
                summary: 'older memory',
                keyDiscoveries: ['k1'],
                unresolvedTopics: ['u1'],
                factCandidates: [],
                createdAt: '2026-05-07T09:00:00.000Z',
              },
            ],
          },
        ],
        facts: [],
      },
    },
  }
}

function makeMetricsSummary(): RuntimeInspectorViewModel['metrics'] {
  return {
    summary: {
      totalTurns: 1,
      turnsWithGm: 0,
      avgAvatarLatencyMs: 120,
      avgTotalTurnLatencyMs: 140,
      avgInputTokens: 12,
      avgOutputTokens: 18,
      avgGmLatencyMs: null,
    },
    turns: [
      {
        turnIndex: 1,
        correlationId: 'corr_1',
        conversationId: 'conversation_1',
        avatarLatencyMs: 120,
        totalTurnLatencyMs: 140,
        overheadMs: 20,
        retrievalLatencyMs: 12,
        inputTokens: 12,
        outputTokens: 18,
        totalTokens: 30,
        model: 'test-model',
        hasGm: false,
      },
    ],
  }
}

function makeContextSummary(): RuntimeInspectorViewModel['context'] {
  return {
    avatar: {
      avatarId: 'avatar_1',
      recentExchanges: [{ user: 'u', avatar: 'a' }],
      knowledge: {
        retrievedItems: [
          {
            sourceId: 'source_1',
            chunkId: 'chunk_1',
            knowledgeType: 'world',
            content: 'A'.repeat(200),
            visibleToAvatarIds: ['avatar_1'],
          },
        ],
      },
      workingMemory: {},
      longTermFacts: [],
      userPersona: null,
      gmNotes: null,
      scenario: {
        scenarioId: 'scenario_1',
      },
    },
    gm: {
      recentMessages: [{ role: 'user', content: 'hello' }],
      knowledge: {
        memory: [],
        world: [{ sourceId: 'source_1', chunkId: 'chunk_1', knowledgeType: 'world', content: 'lore' }],
        media: [],
      },
      memory: {},
        currentState: {
          currentAvatarId: 'avatar_1',
          progression: 'intro',
          topicsCovered: [],
          interactionCount: 1,
        },
        availableAvatars: [
          { avatarId: 'avatar_1', name: 'Clara Whitcombe', availability: 'available' },
          { avatarId: 'avatar_2', name: 'Theo', availability: 'available' },
        ],
        userPersona: null,
        scenario: {
          scenarioId: 'scenario_1',
        },
    },
    trace: {
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
        hasWorkingMemory: false,
        longTermFactCount: 0,
        retrievalCounts: { memory: 0, world: 1, media: 0 },
        visibility: {
          activeAvatarId: 'avatar_1',
          excludedCounts: { memory: 1, world: 2, media: 0 },
          gmRetrievalCounts: { memory: 2, world: 3, media: 1 },
          gmUnrestricted: true,
        },
        hasUserPersona: false,
        hasGmDirective: false,
      },
      rationale: {
        avatarProjection: [],
        gmProjection: [],
      },
      selection: {
        kept: [{ projection: 'avatar', segmentId: 'scenario', tokenEstimate: 18, reason: 'protected' }],
        trimmed: [],
      },
    },
  }
}

function makeRecentEvent(): RuntimeInspectorViewModel['recentEvents'][number] {
  return {
    type: 'turn_completed',
    correlationId: 'corr_1',
    createdAt: '2026-05-07T10:00:00.000Z',
    payload: {
      conversationId: 'conversation_1',
      turnIndex: 1,
      avatarId: 'avatar_1',
      avatarLatencyMs: 100,
      totalTurnLatencyMs: 120,
      inputTokens: 11,
      outputTokens: 17,
      totalTokens: 28,
      model: 'test-model',
      hasGm: false,
    },
  }
}

function makeGmEvent(): RuntimeInspectorViewModel['recentEvents'][number] {
  return {
    type: 'gm_triggered',
    correlationId: 'corr_1',
    createdAt: '2026-05-07T10:00:00.000Z',
    payload: {
      triggerReason: 'topic_shift',
      turnIndex: 1,
      interactionCount: 2,
      stateBefore: {
        progression: 'intro',
        topicsCovered: [],
      },
      decision: {
        avatarId: 'avatar_2',
        conversationMode: 'continue',
        notesInjected: true,
        directiveCount: 2,
        unlockedAvatarIds: ['avatar_2'],
        unlockEvaluations: [
          {
            avatarId: 'avatar_2',
            avatarName: 'Theo',
            reason: 'user asked architecture question',
            outcome: 'unlocked',
          },
        ],
        suggestedAvatarId: 'avatar_2',
        suggestedAvatarReason: 'user asked architecture question',
        switchedAvatarId: 'avatar_2',
      },
      stateAfter: {
        progression: 'deep_dive',
        topicsCovered: ['architecture'],
      },
      latencyMs: 123,
    },
  }
}

function makeMemoryHistory(snapshot: RuntimeInspectorViewModel): MemoryEvolutionSnapshot[] {
  return [
    {
      snapshotId: 'snapshot_1',
      capturedAt: '2026-05-07T10:00:00.000Z',
      turnIndex: 1,
      conversationId: 'conversation_1',
      layers: {
        ...snapshot.memory.layers,
        longTerm: { avatars: [], facts: [] },
      },
    },
    {
      snapshotId: 'snapshot_2',
      capturedAt: '2026-05-07T10:01:00.000Z',
      turnIndex: 2,
      conversationId: 'conversation_1',
      layers: {
        ...snapshot.memory.layers,
        longTerm: {
          avatars: [
            {
              avatarId: 'avatar_1',
              memories: [
                {
                  conversationId: 'conversation_old_1',
                  summary: 'older memory',
                  keyDiscoveries: ['k1'],
                  unresolvedTopics: ['u1'],
                  factCandidates: [],
                  createdAt: '2026-05-07T10:01:00.000Z',
                },
              ],
            },
          ],
          facts: [
            {
              category: 'goal',
              key: 'focus',
              value: 'quality',
              updatedAt: '2026-05-07T10:01:00.000Z',
            },
          ],
        },
      },
    },
  ]
}

// eslint-disable-next-line max-lines-per-function
describe('RuntimeInspectorTabContent', () => {
  it('renders effective models in overview tab', () => {
    const snapshot = makeViewModel()
    const html = renderToStaticMarkup(
      <RuntimeInspectorTabContent
        tab="overview"
        snapshot={snapshot}
        memoryHistory={makeMemoryHistory(snapshot)}
        liveEvents={[]}
        actionStatus={null}
        onReplayGm={vi.fn()}
        onRefreshMemory={vi.fn()}
        onClearMemory={vi.fn()}
        onResetSession={vi.fn()}
        onUpsertPersona={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(html).toContain('Effective models')
    expect(html).toContain('openai / gpt-4.1-mini')
    expect(html).toContain('mistral / mistral-small-latest')
    expect(html).toContain('xai / grok-2-mini')
    expect(html).toContain('avatar_1 (Clara Whitcombe)')
    expect(html).toContain('avatar_2 (Theo) — user asked architecture question')
  })

  it('renders action controls and status text', () => {
    const snapshot = makeViewModel()
    const html = renderToStaticMarkup(
      <RuntimeInspectorTabContent
        tab="actions"
        snapshot={snapshot}
        memoryHistory={makeMemoryHistory(snapshot)}
        liveEvents={[]}
        actionStatus="Action complete"
        onReplayGm={vi.fn()}
        onRefreshMemory={vi.fn()}
        onClearMemory={vi.fn()}
        onResetSession={vi.fn()}
        onUpsertPersona={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(html).toContain('Replay GM')
    expect(html).toContain('Refresh memory')
    expect(html).toContain('Clear session memory')
    expect(html).toContain('Action complete')
  })

  it('falls back to scenarioId when context scenario name is absent', () => {
    const snapshot = makeViewModel()
    const html = renderToStaticMarkup(
      <RuntimeInspectorTabContent
        tab="context"
        snapshot={snapshot}
        memoryHistory={makeMemoryHistory(snapshot)}
        liveEvents={[]}
        actionStatus={null}
        onReplayGm={vi.fn()}
        onRefreshMemory={vi.fn()}
        onClearMemory={vi.fn()}
        onResetSession={vi.fn()}
        onUpsertPersona={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(html).toContain('Scenario')
    expect(html).toContain('scenario_1')
    expect(html).toContain('This tab answers two questions')
    expect(html).toContain('Static knowledge inventory')
    expect(html).toContain('Avatar access')
    expect(html).toContain('Used by avatar for current turn')
    expect(html).toContain('Used by GM for current turn')
    expect(html).toContain('Loaded sources')
    expect(html).toContain('Shared clues')
    expect(html).toContain('Clara private notes')
    expect(html).toContain('access: all avatars')
    expect(html).toContain('access: Clara Whitcombe')
    expect(html).toContain('GM-only sources')
    expect(html).toContain('GM truth')
    expect(html).toContain('Clara Whitcombe: Shared clues, Clara private notes')
    expect(html).toContain('Theo: Shared clues')
    expect(html).toContain('Retrieved knowledge')
    expect(html).toContain('[world] access:Clara Whitcombe')
    expect(html).toContain('[world] access:all avatars lore')
    expect(html).toContain('Assembly diagnostics')
    expect(html).toContain('Deterministic assembly')
  })

  it('renders live runtime events in events tab', () => {
    const snapshot = makeViewModel()
    const liveEvents: RuntimeEvent[] = [
      {
        eventId: 'event_1',
        sessionId: 'session_1',
        type: 'runtime.processing_started',
        occurredAt: '2026-05-07T10:00:00.000Z',
        payload: {},
      },
    ]
    const html = renderToStaticMarkup(
      <RuntimeInspectorTabContent
        tab="events"
        snapshot={snapshot}
        memoryHistory={makeMemoryHistory(snapshot)}
        liveEvents={liveEvents}
        actionStatus={null}
        onReplayGm={vi.fn()}
        onRefreshMemory={vi.fn()}
        onClearMemory={vi.fn()}
        onResetSession={vi.fn()}
        onUpsertPersona={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(html).toContain('Live stream')
    expect(html).toContain('runtime.processing_started')
    expect(html).toContain('Recent snapshot events')
    expect(html).toContain('GM causality trace')
    expect(html).toContain('Trigger/context')
    expect(html).toContain('GM decision/action')
    expect(html).toContain('Resulting impact')
    expect(html).toContain('Avatar unlocks: avatar_2 (Theo) [unlocked]')
    expect(html).toContain('GM recommendation: Theo (avatar_2) — user asked architecture question')
    expect(html).toContain('GM produced 2 structured recommendations.')
    expect(html).toContain('Turn 1')
    expect(html).toContain('Correlation: corr_1')
  })

  it('renders layered memory state and evolution delta copy', () => {
    const snapshot = makeViewModel()
    const html = renderToStaticMarkup(
      <RuntimeInspectorTabContent
        tab="memory"
        snapshot={snapshot}
        memoryHistory={makeMemoryHistory(snapshot)}
        liveEvents={[]}
        actionStatus={null}
        onReplayGm={vi.fn()}
        onRefreshMemory={vi.fn()}
        onClearMemory={vi.fn()}
        onResetSession={vi.fn()}
        onUpsertPersona={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(html).toContain('Short-term exchange memory')
    expect(html).toContain('Working memory')
    expect(html).toContain('Long-term avatar memories')
    expect(html).toContain('Memory evolution')
    expect(html).toContain('active working summary')
    expect(html).toContain('Working updated at')
    expect(html).toContain('Fact count')
    expect(html).toContain('conversation_old_1 [2026-05-07T09:00:00.000Z]: older memory')
    expect(html).toContain('New long-term avatar memory stored')
  })

  it('renders turn profiler latency and token breakdown safely without GM optional metrics', () => {
    const snapshot = makeViewModel()
    const html = renderToStaticMarkup(
      <RuntimeInspectorTabContent
        tab="metrics"
        snapshot={snapshot}
        memoryHistory={makeMemoryHistory(snapshot)}
        liveEvents={[]}
        actionStatus={null}
        onReplayGm={vi.fn()}
        onRefreshMemory={vi.fn()}
        onClearMemory={vi.fn()}
        onResetSession={vi.fn()}
        onUpsertPersona={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(html).toContain('Turn profiler')
    expect(html).toContain('total 140ms')
    expect(html).toContain('rag 12ms')
    expect(html).toContain('llm 120ms')
    expect(html).toContain('gm -')
    expect(html).toContain('conversation_1')
    expect(html).toContain('tokens 30 (in 12 / out 18)')
  })
})

describe('buildPersonaPayload', () => {
  it('trims fields and splits relationships while dropping empty lines', () => {
    const payload = buildPersonaPayload({
      name: ' Maya ',
      roleInWorld: ' student ',
      relationshipsText: '  Friend of Eva  \n\n Brother of Tom\n',
      dialogGuidance: ' Keep things concise. ',
    })

    expect(payload).toEqual({
      name: 'Maya',
      roleInWorld: 'student',
      avatarRelationships: ['Friend of Eva', 'Brother of Tom'],
      dialogGuidance: 'Keep things concise.',
    })
  })

  it('returns an empty payload when all fields are blank', () => {
    const payload = buildPersonaPayload({
      name: ' ',
      roleInWorld: '',
      relationshipsText: '\n   \n',
      dialogGuidance: '   ',
    })

    expect(payload).toEqual({})
  })
})

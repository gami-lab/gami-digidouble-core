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
        {
          sourceId: 'source_gm_only_policy',
          scenarioId: 'scenario_1',
          name: 'GM truth v2',
          knowledgeType: 'world',
          format: 'markdown',
          uriOrPath: '/tmp/gm-truth-v2.md',
          status: 'ready',
          visibilityPolicy: 'none',
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
          coveredTopics: ['quality_goal'],
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
    sessionId: 'session_1',
    avatarContext: makeAvatarContext(),
    gmContext: makeGmContext(),
    contextTrace: makeContextTrace(),
  }
}

function makeAvatarContext(): RuntimeInspectorViewModel['context']['avatarContext'] {
  return {
    avatarId: 'avatar_1',
    sections: {
      directorNotes: 'Focus on examples.',
      responseRules: { items: ['Use short answers.'] },
      conversationState: {
        recentExchanges: [{ user: 'u', avatar: 'a' }],
        workingMemory: {
          session: {
            summary: 'active working summary',
            updatedAt: '2026-05-07T10:00:00.000Z',
          },
        },
        longTermFacts: [{ category: 'goal', key: 'focus', value: 'quality' }],
      },
      userPersona: { name: 'Maya', roleInWorld: 'investigator' },
      worldContext: {
        scenarioId: 'scenario_1',
        description: 'Scenario world',
        goals: ['Obj1', 'Goal1'],
      },
      avatarTraits: {
        identity: ['Ava'],
        personality: ['Calm'],
        speakingStyle: [],
        background: [],
        timeline: [],
        currentSituation: [],
        behaviouralRules: [],
      },
    },
  }
}

function makeGmContext(): RuntimeInspectorViewModel['context']['gmContext'] {
  return {
    currentState: {
      currentAvatarId: 'avatar_1',
      progression: 'intro',
      topicsCovered: [],
      interactionCount: 1,
    },
    availableAvatars: [{ avatarId: 'avatar_1', name: 'Ava', availability: 'available' }],
    sections: {
      conversationState: {
        recentMessages: [{ role: 'user', content: 'u' }, { role: 'avatar', content: 'a' }],
        memory: {
          workingMemory: {
            summary: 'active working summary',
            unresolvedThreads: ['follow_up'],
            coveredTopics: ['quality_goal'],
          },
          workingSummary: 'active working summary',
        },
      },
      userPersona: { name: 'Maya', roleInWorld: 'investigator' },
      worldContext: { scenarioId: 'scenario_1', description: 'Scenario world' },
    },
  }
}

function makeContextTrace(): RuntimeInspectorViewModel['context']['contextTrace'] {
  return {
    deterministic: true,
    policy: {
      tokenBudget: { avatarMaxTokens: 4096, gmMaxTokens: 4096 },
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
      recentMessageCount: 2,
      shortTermExchangeCount: 1,
      hasWorkingMemory: true,
      longTermFactCount: 1,
      retrievalCounts: { memory: 0, world: 0, media: 0 },
      hasUserPersona: true,
      hasGmDirective: true,
      responseRuleCount: 1,
      hasAvatarTraits: true,
    },
    rationale: { avatarProjection: [], gmProjection: [] },
    selection: {
      kept: [
        {
          projection: 'avatar',
          sectionId: 'responseRules',
          segmentId: 'responseRules',
          tokenEstimate: 5,
          reason: 'protected',
        },
      ],
      trimmed: [],
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
        dialogueMode: 'avatar_guided',
        askFollowUp: false,
        notesInjected: true,
        retrievalRequired: false,
        unlockedAvatarIds: ['avatar_2'],
        unlockEvaluations: [
          {
            avatarId: 'avatar_2',
            avatarName: 'Theo',
            reason: 'user asked architecture question',
            outcome: 'unlocked',
          },
        ],
        routingAction: 'suggest',
        routingAvatarId: 'avatar_2',
        routingReason: 'user asked architecture question',
        switchedAvatarId: 'avatar_2',
        progression: 'increase',
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
    expect(html).toContain('avatar_1')
    expect(html).toContain('avatar_2 — user asked architecture question')
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

  it('renders the stable session context snapshot and static knowledge inventory', () => {
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
    expect(html).toContain('canonical runtime context snapshot')
    expect(html).toContain('Static knowledge inventory')
    expect(html).toContain('Avatar runtime context')
    expect(html).toContain('Loaded sources')
    expect(html).toContain('Shared clues')
    expect(html).toContain('Clara private notes')
    expect(html).toContain('access: all avatars')
    expect(html).toContain('access: avatar_1')
    expect(html).toContain('GM-only sources')
    expect(html).toContain('GM truth')
    expect(html).toContain('GM truth v2')
    expect(html).toContain('Director notes')
    expect(html).toContain('Focus on examples.')
    expect(html).toContain('World goals')
    expect(html).toContain('Obj1 | Goal1')
    expect(html).toContain('Response rules')
    expect(html).toContain('Use short answers.')
    expect(html).toContain('Recent exchanges')
    expect(html).toContain('U: u / A: a')
    expect(html).toContain('Context trace')
    expect(html).toContain('Protected segments')
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
    expect(html).toContain('GM run')
    expect(html).toContain('GM outputs')
    expect(html).toContain('User-visible effect')
    expect(html).toContain('Avatar unlocks: avatar_2 (Theo) [unlocked]')
    expect(html).toContain('GM recommendation: Theo (avatar_2) — user asked architecture question')
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
    expect(html).toContain('Covered topics')
    expect(html).toContain('quality_goal')
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

  it('points operators to the events tab for turn-specific retrieval usage', () => {
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

    expect(html).toContain('Events tab.')
    expect(html).toContain('GM covered topics')
    expect(html).toContain('quality_goal')
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

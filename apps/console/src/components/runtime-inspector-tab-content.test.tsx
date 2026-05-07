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
    memory: makeMemorySummary(),
    metrics: makeMetricsSummary(),
    context: makeContextSummary(),
    persona: null,
    recentEvents: [makeRecentEvent()],
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
      shortTerm: {
        exchangeCount: 2,
        recentExchanges: [{ user: 'u', avatar: 'a' }],
      },
      working: {
        session: {
          summary: 'session summary',
          updatedAt: '2026-05-07T10:00:00.000Z',
        },
        avatars: [],
      },
      longTerm: {
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
  }
}

function makeContextSummary(): RuntimeInspectorViewModel['context'] {
  return {
    avatar: {
      avatarId: 'avatar_1',
      recentExchanges: [{ user: 'u', avatar: 'a' }],
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
      memory: {},
      currentState: {
        progression: 'intro',
        topicsCovered: [],
        interactionCount: 1,
      },
      availableAvatars: [],
      userPersona: null,
      scenario: {
        scenarioId: 'scenario_1',
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

function makeMemoryHistory(snapshot: RuntimeInspectorViewModel): MemoryEvolutionSnapshot[] {
  return [
    {
      snapshotId: 'snapshot_1',
      capturedAt: '2026-05-07T10:00:00.000Z',
      turnIndex: 1,
      conversationId: 'conversation_1',
      layers: {
        ...snapshot.memory.layers,
        longTerm: { facts: [] },
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

describe('RuntimeInspectorTabContent', () => {
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
    expect(html).toContain('Long-term facts')
    expect(html).toContain('Memory evolution')
    expect(html).toContain('New long-term fact extracted')
  })
})

describe('buildPersonaPayload', () => {
  it('trims fields and splits hints while dropping empty lines', () => {
    const payload = buildPersonaPayload({
      role: ' coach ',
      tonePreference: ' concise ',
      hintsText: '  ask one thing  \n\n keep it brief\n',
    })

    expect(payload).toEqual({
      role: 'coach',
      tonePreference: 'concise',
      interactionHints: ['ask one thing', 'keep it brief'],
    })
  })

  it('returns an empty payload when all fields are blank', () => {
    const payload = buildPersonaPayload({
      role: ' ',
      tonePreference: '',
      hintsText: '\n   \n',
    })

    expect(payload).toEqual({})
  })
})

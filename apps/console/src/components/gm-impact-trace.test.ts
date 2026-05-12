import { describe, expect, it } from 'vitest'
import type { RuntimeInspectorViewModel } from '../api'
import { buildGmImpactTrace } from './gm-impact-trace'

// eslint-disable-next-line max-lines-per-function
function makeViewModel(): RuntimeInspectorViewModel {
  return {
    session: {
      sessionId: 'session_1',
      userId: 'user_1',
      scenarioId: 'scenario_1',
      status: 'active',
      startedAt: '2026-05-07T10:00:00.000Z',
      lastActivityAt: '2026-05-07T10:00:00.000Z',
    },
    runtimeState: {
      sessionId: 'session_1',
      canSendMessage: true,
      isProcessing: false,
      updatedAt: '2026-05-07T10:00:00.000Z',
    },
    gm: {
      gmState: null,
      gmNotes: null,
      transitionHistory: [
        {
          fromAvatarId: 'avatar_1',
          toAvatarId: 'avatar_2',
          reason: 'topic_shift',
          startedBy: 'gm',
          transitionedAt: '2026-05-07T10:00:00.000Z',
        },
      ],
      unlockedAvatarIds: ['avatar_2'],
    },
    memory: {
      summary: {
        sessionId: 'session_1',
        summary: 'memory',
        updatedAt: '2026-05-07T10:00:00.000Z',
      },
      layers: {
        sessionId: 'session_1',
        shortTerm: {
          exchangeCount: 2,
          recentExchanges: [],
        },
        working: {
          avatars: [],
        },
        longTerm: {
          avatars: [],
          facts: [],
        },
      },
    },
    metrics: {
      summary: {
        totalTurns: 1,
        turnsWithGm: 1,
        avgAvatarLatencyMs: 100,
        avgTotalTurnLatencyMs: 120,
        avgInputTokens: 10,
        avgOutputTokens: 20,
        avgGmLatencyMs: 60,
      },
      turns: [],
    },
    context: {
      avatar: {
        recentExchanges: [],
        workingMemory: {},
        longTermFacts: [],
        userPersona: null,
        gmNotes: null,
        scenario: { scenarioId: 'scenario_1' },
      },
      gm: {
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
      trace: undefined,
    },
    persona: null,
    recentEvents: [
      {
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
            directiveCount: 1,
            unlockedAvatarIds: ['avatar_2'],
            suggestedAvatarId: 'avatar_2',
            suggestedAvatarReason: 'topic depth',
            switchedAvatarId: 'avatar_2',
          },
          stateAfter: {
            progression: 'deep_dive',
            topicsCovered: ['architecture'],
          },
          latencyMs: 40,
        },
      },
      {
        type: 'turn_completed',
        correlationId: 'corr_1',
        createdAt: '2026-05-07T10:00:01.000Z',
        payload: {
          conversationId: 'conversation_1',
          turnIndex: 1,
          avatarId: 'avatar_2',
          avatarLatencyMs: 80,
          totalTurnLatencyMs: 120,
          inputTokens: 10,
          outputTokens: 20,
          totalTokens: 30,
          model: 'test-model',
          hasGm: true,
          contextSelection: {
            shortTermExchangeCount: 2,
            hasWorkingMemory: true,
            longTermFactCount: 1,
            retrievalCounts: {
              memory: 1,
              world: 2,
              media: 0,
            },
            hasUserPersona: false,
            hasGmDirective: true,
          },
        },
      },
    ],
  }
}

describe('buildGmImpactTrace', () => {
  it('maps gm trigger to concrete causality chain with impacts', () => {
    const trace = buildGmImpactTrace(makeViewModel())
    const first = trace[0]

    expect(trace).toHaveLength(1)
    expect(first).toBeDefined()
    if (!first) return
    expect(first.turnIndex).toBe(1)
    expect(first.timelinePosition).toBe('1/1')
    expect(first.gmDecisionAction.join(' ')).toContain('Decision: avatar avatar_2')
    expect(first.resultingImpact.join(' ')).toContain('Avatar unlocks: avatar_2')
    expect(first.resultingImpact.join(' ')).toContain('Routing suggestion: avatar_2')
    expect(first.resultingImpact.join(' ')).toContain('GM notes/directives injected into context')
    expect(first.resultingImpact.join(' ')).toContain('User-flow impact: completed turn 1')
    expect(first.resultingImpact.join(' ')).toContain(
      'Context selection: short-term 2, long-term 1, retrieval 1/2/0',
    )
    expect(first.status).toBe('applied')
  })
})

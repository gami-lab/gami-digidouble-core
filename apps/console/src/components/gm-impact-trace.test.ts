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
    effectiveModels: {
      avatar: { provider: 'openai', model: 'gpt-4.1-mini' },
      gameMaster: { provider: 'mistral', model: 'mistral-small-latest' },
      memory: { provider: 'xai', model: 'grok-2-mini' },
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
    knowledge: {
      sources: [],
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
        availableAvatars: [
          { avatarId: 'avatar_1', name: 'Clara Whitcombe', availability: 'available' },
          { avatarId: 'avatar_2', name: 'Theo', availability: 'available' },
        ],
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
            currentAvatarId: 'avatar_1',
            progression: 'intro',
            topicsCovered: [],
          },
          decision: {
            avatarId: 'avatar_2',
            conversationMode: 'new',
            notesInjected: true,
            injectedNote: 'Ask Theo for concrete implementation details next.',
            directiveCount: 1,
            unlockedAvatarIds: ['avatar_2'],
            unlockEvaluations: [
              {
                avatarId: 'avatar_2',
                avatarName: 'Theo',
                reason: 'topic depth',
                outcome: 'unlocked',
              },
            ],
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
    expect(first.interactionCount).toBe(2)
    expect(first.timelinePosition).toBe('1/1')
    expect(first.gmDecisionAction).toContain('GM ran after turn 1 because topic shift.')
    expect(first.gmDecisionAction.join(' ')).toContain(
      'Before the decision, the active avatar was Clara Whitcombe (avatar_1)',
    )
    expect(first.gmDecisionAction.join(' ')).toContain(
      'GM asked to start a new conversation with Theo (avatar_2).',
    )
    expect(first.resultingImpact.join(' ')).toContain('Avatar unlocks: avatar_2 (Theo) [unlocked]')
    expect(first.resultingImpact.join(' ')).toContain(
      'GM recommendation: Theo (avatar_2) — topic depth',
    )
    expect(first.resultingImpact.join(' ')).toContain(
      'GM note added to the next avatar turn: Ask Theo for concrete implementation details next.',
    )
    expect(first.resultingImpact.join(' ')).toContain(
      'Immediate user-facing result: turn 1 was still answered by Theo (avatar_2). GM changes apply on the next turn.',
    )
    expect(first.resultingImpact.join(' ')).toContain(
      'Avatar context used for this reply: 2 recent exchanges, working memory included, 1 long-term fact, 3 retrieved references (1 memory / 2 world / 0 media), GM note included, no user persona',
    )
    expect(first.status).toBe('applied')
  })

  it('sorts trace entries by interactionCount when turnIndex resets after avatar switches', () => {
    const snapshot = makeViewModel()
    snapshot.recentEvents = [
      {
        type: 'gm_triggered',
        correlationId: 'corr_old',
        createdAt: '2026-05-07T10:00:00.000Z',
        payload: {
          triggerReason: 'post_turn_observation',
          turnIndex: 5,
          interactionCount: 12,
          stateBefore: {
            currentAvatarId: 'avatar_1',
            progression: 'advanced',
            topicsCovered: [],
          },
          decision: {
            avatarId: 'avatar_1',
            conversationMode: 'continue',
            notesInjected: true,
            injectedNote: 'Older interaction.',
            directiveCount: 0,
          },
          stateAfter: {
            currentAvatarId: 'avatar_1',
            progression: 'advanced',
            topicsCovered: [],
          },
          latencyMs: 40,
        },
      },
      {
        type: 'gm_triggered',
        correlationId: 'corr_new',
        createdAt: '2026-05-07T10:00:01.000Z',
        payload: {
          triggerReason: 'post_turn_observation',
          turnIndex: 1,
          interactionCount: 16,
          stateBefore: {
            currentAvatarId: 'avatar_2',
            progression: 'advanced',
            topicsCovered: [],
          },
          decision: {
            avatarId: 'avatar_2',
            conversationMode: 'continue',
            notesInjected: true,
            injectedNote: 'Newer interaction after avatar switch.',
            directiveCount: 0,
          },
          stateAfter: {
            currentAvatarId: 'avatar_2',
            progression: 'advanced',
            topicsCovered: [],
          },
          latencyMs: 42,
        },
      },
    ]

    const trace = buildGmImpactTrace(snapshot)

    expect(trace.map((entry) => entry.correlationId)).toEqual(['corr_new', 'corr_old'])
    expect(trace.map((entry) => entry.interactionCount)).toEqual([16, 12])
    expect(trace.map((entry) => entry.turnIndex)).toEqual([1, 5])
  })
})

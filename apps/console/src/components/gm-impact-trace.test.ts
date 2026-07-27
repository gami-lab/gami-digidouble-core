import { describe, expect, it } from 'vitest'
import type { GmSessionEventPayload, TurnCompletedEventPayload } from '@gami/shared'
import type { RuntimeInspectorViewModel } from '../api'
import { buildGmImpactTrace } from './gm-impact-trace'

/* eslint-disable max-lines */
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
      sources: [
        {
          sourceId: 'source_1',
          scenarioId: 'scenario_1',
          name: 'Terrace notes',
          knowledgeType: 'world',
          format: 'markdown',
          uriOrPath: '/tmp/terrace.md',
          status: 'ready',
          createdAt: '2026-05-07T10:00:00.000Z',
        },
        {
          sourceId: 'source_2',
          scenarioId: 'scenario_1',
          name: 'Footprint report',
          knowledgeType: 'world',
          format: 'markdown',
          uriOrPath: '/tmp/footprints.md',
          status: 'ready',
          createdAt: '2026-05-07T10:00:00.000Z',
        },
      ],
    },
    context: {
      sessionId: 'session_1',
      avatarContext: {
        sections: {
          directorNotes: null,
          responseRules: { items: [] },
          conversationState: {
            recentExchanges: [],
            workingMemory: {},
            longTermFacts: [],
          },
          userPersona: null,
          worldContext: {
            scenarioId: 'scenario_1',
            description: 'Scenario world',
            goals: ['Find the culprit'],
          },
        },
      },
      gmContext: {
        currentState: {
          progression: '',
          interactionCount: 0,
        },
        availableAvatars: [],
        sections: {
          conversationState: {
            recentMessages: [],
            memory: {},
          },
          userPersona: null,
          worldContext: { scenarioId: 'scenario_1' },
        },
      },
      contextTrace: {
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
          recentMessageCount: 0,
          shortTermExchangeCount: 0,
          hasWorkingMemory: false,
          longTermFactCount: 0,
          retrievalCounts: { memory: 0, world: 0, media: 0 },
          hasUserPersona: false,
          hasGmDirective: false,
          responseRuleCount: 0,
          hasAvatarTraits: false,
        },
        rationale: { avatarProjection: [], gmProjection: [] },
        selection: { kept: [], trimmed: [] },
      },
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
          gmContext: {
            currentState: {
              progression: 'intro',
              interactionCount: 2,
            },
            availableAvatars: [
              { avatarId: 'avatar_1', name: 'Clara Whitcombe', availability: 'available' },
              { avatarId: 'avatar_2', name: 'Theo', availability: 'available' },
            ],
            sections: {
              conversationState: {
                recentMessages: [{ role: 'user', content: 'Who left last night?' }],
                memory: {
                  shortTerm: { recentExchanges: [{ user: 'u1', avatar: 'a1' }] },
                  workingMemory: {
                    summary: 'GM working summary',
                    unresolvedThreads: ['Confirm the dock number'],
                    coveredTopics: ['witness_timeline'],
                  },
                  workingSummary: 'GM working summary',
                  longTermFacts: [
                    {
                      category: 'context',
                      key: 'departure',
                      value: 'Thomas left late',
                    },
                  ],
                },
              },
              retrievedContext: {
                memory: [],
                world: [
                  {
                    sourceId: 'source_1',
                    chunkId: 'chunk_1',
                    knowledgeType: 'world',
                    content: 'GM clue content',
                    score: 0.4444,
                    reason: 'token-overlap',
                    matchedQuery: { source: 'world_context', text: 'Scenario world' },
                    visibleToAvatarIds: ['avatar_1'],
                  },
                ],
                media: [],
              },
              userPersona: { name: 'Maya', roleInWorld: 'investigator' },
              worldContext: { scenarioId: 'scenario_1', name: 'Scenario 1' },
            },
          },
          stateBefore: {
            progression: 'intro',
          },
          decision: {
            dialogueMode: 'transition',
            askFollowUp: false,
            notesInjected: true,
            injectedNote: 'Ask Theo for concrete implementation details next.',
            retrievalRequired: false,
            unlockedAvatarIds: ['avatar_2'],
            unlockEvaluations: [
              {
                avatarId: 'avatar_2',
                avatarName: 'Theo',
                reason: 'topic depth',
                outcome: 'unlocked',
              },
            ],
            routingAction: 'suggest',
            routingAvatarId: 'avatar_2',
            routingReason: 'topic depth',
            switchedAvatarId: 'avatar_2',
            progression: 'increase',
          },
          stateAfter: {
            progression: 'deep_dive',
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
          avatarContext: {
            avatarId: 'avatar_2',
            sections: {
              directorNotes: 'Ask Theo for concrete implementation details next.',
              responseRules: { count: 1 },
              conversationState: {
                recentExchanges: [{ user: 'Did Thomas leave?', avatar: 'Not yet.' }],
                workingMemory: {
                  session: {
                    summary: 'Session summary',
                    updatedAt: '2026-05-07T10:00:00.000Z',
                  },
                  avatar: {
                    avatarId: 'avatar_2',
                    summary: 'Theo summary',
                    updatedAt: '2026-05-07T10:00:00.000Z',
                  },
                },
                longTermFacts: [
                  {
                    category: 'context',
                    key: 'terrace',
                    value: 'Door was ajar',
                  },
                ],
              },
              retrievedContext: {
                memory: [],
                world: [
                  {
                    sourceId: 'source_2',
                    chunkId: 'chunk_2',
                    knowledgeType: 'world',
                    content: 'Avatar clue content',
                    score: 0.8123,
                    reason: 'token-overlap',
                    matchedQuery: { source: 'last_user_input', text: 'Who did it?' },
                    visibleToAvatarIds: ['avatar_2'],
                  },
                ],
                media: [],
              },
              userPersona: { name: 'Maya', roleInWorld: 'investigator' },
              worldContext: { scenarioId: 'scenario_1', name: 'Scenario 1' },
              avatarTraits: {
                sectionCounts: {
                  identity: 1,
                  personality: 1,
                  speakingStyle: 0,
                  background: 0,
                  timeline: 0,
                  currentSituation: 0,
                  behaviouralRules: 0,
                },
              },
            },
          },
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
            retrieval: {
              selectedForAssemblyCounts: {
                memory: 1,
                world: 2,
                media: 0,
              },
              includedCounts: {
                memory: 0,
                world: 1,
                media: 0,
              },
              omittedByAssemblyCounts: {
                memory: 1,
                world: 1,
                media: 0,
              },
              excludedByVisibilityCounts: {
                memory: 0,
                world: 0,
                media: 0,
              },
            },
            hasUserPersona: false,
            hasGmDirective: true,
            responseRuleCount: 1,
            hasAvatarTraits: true,
          },
        },
      },
    ],
  }
}

// eslint-disable-next-line max-lines-per-function
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
    expect(first.gmRun).toContain('GM ran after turn 1 because topic shift.')
    expect(first.gmRun.join(' ')).toContain('Before the decision, progression was "intro".')
    expect(first.gmRun.join(' ')).toContain(
      'GM set the next dialogue mode to "transition". Progression was marked as advanced.',
    )
    expect(first.gmOutput.join(' ')).toContain('Avatar unlocks: avatar_2 (Theo) [unlocked]')
    expect(first.gmOutput.join(' ')).toContain('GM recommendation: Theo (avatar_2) — topic depth')
    expect(first.gmOutput.join(' ')).toContain(
      'GM note added to the next avatar turn: Ask Theo for concrete implementation details next.',
    )
    expect(first.userVisibleOutcome.join(' ')).toContain(
      'Immediate user-facing result: turn 1 was still answered by Theo (avatar_2). GM changes apply on the next turn.',
    )
    expect(first.gmInput.join(' ')).toContain('GM input summary: 1 message(s)')
    expect(first.gmInput.join(' ')).toContain('GM working memory: GM working summary')
    expect(first.gmInput.join(' ')).toContain('GM unresolved threads: Confirm the dock number')
    expect(first.gmInput.join(' ')).toContain('GM covered topics: witness_timeline')
    expect(first.gmRetrieval).toEqual([
      {
        knowledgeType: 'world',
        sourceName: 'Terrace notes',
        chunkId: 'chunk_1',
        access: 'Clara Whitcombe',
        score: 0.4444,
        matchBasis: 'keyword match',
        content: 'GM clue content',
        matchedQuery: { source: 'world_context', text: 'Scenario world' },
      },
    ])
    expect(first.avatarInput.join(' ')).toContain('Avatar input summary: 1 exchange(s)')
    expect(first.avatarInput.join(' ')).toContain('Avatar working memory: Theo summary')
    expect(first.avatarInput.join(' ')).toContain('1 response rule applied')
    expect(first.avatarInput.join(' ')).toContain('avatar traits included')
    expect(first.avatarRetrieval).toEqual([
      {
        knowledgeType: 'world',
        sourceName: 'Footprint report',
        chunkId: 'chunk_2',
        access: 'Theo',
        score: 0.8123,
        matchBasis: 'keyword match',
        content: 'Avatar clue content',
        matchedQuery: { source: 'last_user_input', text: 'Who did it?' },
      },
    ])
    expect(first.avatarInput.join(' ')).toContain(
      'Avatar context used for this reply: 2 recent exchanges, working memory included, 1 long-term fact, 1 retrieved reference included (0 memory / 1 world / 0 media), 1 response rule applied, avatar traits included, GM note included, no user persona',
    )
    expect(first.avatarInput.join(' ')).toContain(
      'Avatar retrieval assembly: 3 hits selected for assembly, 1 included in the final avatar input, 0 excluded by avatar visibility, 2 omitted during final assembly',
    )
    expect(first.errors).toEqual([])
    expect(first.status).toBe('applied')
  })

  it('links a GM retrieval plan to the subsequent Avatar turn and reports matches', () => {
    const snapshot = makeViewModel()
    const gmEvent = snapshot.recentEvents.find((event) => event.type === 'gm_triggered')
    const turnEvent = snapshot.recentEvents.find((event) => event.type === 'turn_completed')
    if (gmEvent?.type !== 'gm_triggered' || turnEvent?.type !== 'turn_completed') return
    const gmPayload = gmEvent.payload as GmSessionEventPayload
    const turnPayload = turnEvent.payload as TurnCompletedEventPayload
    if (turnPayload.avatarContext === undefined) return
    if (gmPayload.decision === undefined) return

    gmPayload.decision = {
      ...gmPayload.decision,
      retrievalRequired: true,
      retrievalPlan: {
        required: true,
        queries: ['Mona harbor'],
        requiredFacts: ['Mona current location'],
      },
    }

    snapshot.recentEvents.push({
      ...turnEvent,
      correlationId: 'corr_2',
      createdAt: '2026-05-07T10:00:02.000Z',
      payload: {
        ...turnPayload,
        correlationId: 'corr_2',
        turnIndex: 2,
        consumedGmRetrievalPlan: {
          generatedAfterTurn: 1,
          generatedAt: '2026-05-07T10:00:01.000Z',
          consumedOnTurn: 2,
          required: true,
          queries: ['Mona harbor'],
          requiredFacts: ['Mona current location'],
        },
        avatarContext: {
          ...turnPayload.avatarContext,
          sections: {
            ...turnPayload.avatarContext.sections,
            retrievedContext: {
              memory: [],
              world: [
                {
                  sourceId: 'source_1',
                  chunkId: 'chunk_plan_match',
                  knowledgeType: 'world',
                  content: 'Mona is currently in the harbor.',
                  matchedQuery: { source: 'gm_retrieval_query', text: 'Mona harbor' },
                },
              ],
              media: [],
            },
          },
        },
      },
    })

    const trace = buildGmImpactTrace(snapshot)
    const first = trace.find((entry) => entry.correlationId === 'corr_1')

    expect(first?.gmRetrievalPlan).toEqual({
      required: true,
      queries: [{ text: 'Mona harbor', matchedChunkIds: ['chunk_plan_match'] }],
      requiredFacts: [{ text: 'Mona current location', matchedChunkIds: [] }],
      consumedByTurnIndex: 2,
    })
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
          stateBefore: { progression: 'advanced' },
          decision: {
            dialogueMode: 'user_led',
            askFollowUp: false,
            notesInjected: true,
            injectedNote: 'Older interaction.',
            retrievalRequired: false,
            progression: 'none',
          },
          stateAfter: { progression: 'advanced' },
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
          stateBefore: { progression: 'advanced' },
          decision: {
            dialogueMode: 'user_led',
            askFollowUp: false,
            notesInjected: true,
            injectedNote: 'Newer interaction after avatar switch.',
            retrievalRequired: false,
            progression: 'none',
          },
          stateAfter: { progression: 'advanced' },
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

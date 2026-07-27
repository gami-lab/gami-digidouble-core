import { describe, expect, it } from 'vitest'
import { normalizePersistedOrchestration } from './gm-state-migration.js'

describe('normalizePersistedOrchestration', () => {
  it('drops legacy memory/count fields while preserving valid current orchestration', () => {
    const normalized = normalizePersistedOrchestration({
      activeAvatarId: 'avatar_1',
      generatedAfterTurn: 3,
      generatedAt: '2026-07-25T10:00:00.000Z',
      topicCovered: 'Mona location',
      interactionIncrement: 1,
      dialogueControl: { mode: 'repair', askFollowUp: false },
      retrievalPlan: { required: true, queries: ['Mona location'] },
      progressionUpdate: { progression: 'none' },
    })

    expect(normalized).toEqual({
      activeAvatarId: 'avatar_1',
      generatedAfterTurn: 3,
      generatedAt: '2026-07-25T10:00:00.000Z',
      dialogueControl: { mode: 'repair', askFollowUp: false },
      retrievalPlan: { required: true, queries: ['Mona location'] },
      progressionUpdate: { progression: 'none' },
    })
    expect(normalized).not.toHaveProperty('topicCovered')
    expect(normalized).not.toHaveProperty('interactionIncrement')
  })

  it('maps an unambiguous legacy switch and defaults ambiguous legacy routing to no change', () => {
    expect(
      normalizePersistedOrchestration({
        activeAvatarId: 'avatar_1',
        generatedAfterTurn: 2,
        generatedAt: '2026-07-25T10:00:00.000Z',
        stateUpdate: { activeAvatarId: 'avatar_2', interactionIncrement: 1 },
      })?.routing,
    ).toEqual({ action: 'switch', avatarId: 'avatar_2' })

    expect(
      normalizePersistedOrchestration({
        activeAvatarId: 'avatar_1',
        generatedAfterTurn: 2,
        generatedAt: '2026-07-25T10:00:00.000Z',
        stateUpdate: { topicCovered: 'Mona location', interactionIncrement: 1 },
      }),
    ).not.toHaveProperty('routing')
  })

  it('normalizes orchestration persisted as a JSON string', () => {
    const normalized = normalizePersistedOrchestration(
      JSON.stringify({
        activeAvatarId: 'avatar_1',
        generatedAfterTurn: 1,
        generatedAt: '2026-07-25T10:00:00.000Z',
        dialogueControl: { mode: 'user_led', askFollowUp: false },
        retrievalPlan: { required: false },
        progressionUpdate: { progression: 'none' },
      }),
    )

    expect(normalized?.dialogueControl).toEqual({ mode: 'user_led', askFollowUp: false })
  })

  it('round-trips current retrieval scopes and multi-target unlock decisions', () => {
    const normalized = normalizePersistedOrchestration({
      activeAvatarId: 'avatar_1',
      generatedAfterTurn: 4,
      generatedAt: '2026-07-25T10:00:00.000Z',
      dialogueControl: { mode: 'transition', askFollowUp: false },
      retrievalPlan: {
        required: true,
        queries: ['Mona location'],
        requiredFacts: ['Mona last confirmed location'],
        scopes: ['world_context', 'scenario_knowledge', 'world_context', 'invalid'],
      },
      routing: {
        action: 'unlock',
        unlockDecisions: [
          { avatarId: 'avatar_2', reason: 'Specialist context is needed.' },
          { avatarId: 'avatar_3', reason: 'A second perspective is relevant.' },
          { avatarId: '', reason: 'ignored' },
        ],
      },
      progressionUpdate: { progression: 'none' },
    })

    expect(normalized?.retrievalPlan).toEqual({
      required: true,
      queries: ['Mona location'],
      requiredFacts: ['Mona last confirmed location'],
      scopes: ['world_context', 'scenario_knowledge'],
    })
    expect(normalized?.routing).toEqual({
      action: 'unlock',
      unlockDecisions: [
        { avatarId: 'avatar_2', reason: 'Specialist context is needed.' },
        { avatarId: 'avatar_3', reason: 'A second perspective is relevant.' },
      ],
    })
  })
})

import { describe, expect, it } from 'vitest'
import { toScenarioSnapshot } from '../../application/use-cases/send-message/send-message.context-engine.js'
import type { Scenario } from '../scenario/scenario.types.js'
import type { Session } from '../conversation/session.types.js'
import { applyPresentationMutation, readPresentation } from './presentation.js'

describe('presentation config mapping', () => {
  it('stores trimmed presentation under uiHints and reads it back', () => {
    const config = applyPresentationMutation(
      'avatar',
      { scope: 'guide' },
      {},
      {
        hook: '  A hook ',
        starterQuestions: [' Who? '],
      },
    )

    expect(config).toEqual({
      scope: 'guide',
      uiHints: { hook: 'A hook', starterQuestions: ['Who?'] },
    })
    expect(readPresentation('avatar', config)).toEqual({
      hook: 'A hook',
      starterQuestions: ['Who?'],
    })
  })

  it('keeps the existing presentation when only config changes, and clears it with null', () => {
    const existing = { scope: 'old', uiHints: { tagline: 'Kept' } }

    expect(applyPresentationMutation('scenario', { goals: [] }, existing, undefined)).toEqual({
      goals: [],
      uiHints: { tagline: 'Kept' },
    })
    expect(applyPresentationMutation('scenario', undefined, existing, null)).toEqual({
      scope: 'old',
    })
  })

  it('rejects invalid presentation and presentation embedded in config', () => {
    expect(() => applyPresentationMutation('avatar', undefined, {}, { color: 'red' })).toThrow(
      'presentation',
    )
    expect(() =>
      applyPresentationMutation('scenario', { uiHints: { tagline: 'x' } }, {}, undefined),
    ).toThrow('top-level')
  })

  it('ignores stored values that no longer match the contract', () => {
    expect(readPresentation('avatar', { uiHints: { accentColor: '#6C5CE7' } })).toBeUndefined()
  })
})

describe('Core orchestration ignores presentation', () => {
  it('builds the same scenario context snapshot with or without presentation', () => {
    const session = { scenarioId: 'scenario_1' } as Session
    const scenario: Scenario = {
      scenarioId: 'scenario_1',
      name: 'House',
      status: 'active',
      objectives: ['Explore'],
      worldContext: 'A quiet house.',
      avatarAvailability: { initialAvatarIds: [] },
      config: { goals: ['Find the key'] },
      createdAt: '2026-10-19T10:00:00.000Z',
      updatedAt: '2026-10-19T10:00:00.000Z',
    }
    const presented = { ...scenario, config: { ...scenario.config, uiHints: { tagline: 'T' } } }

    expect(toScenarioSnapshot(session, presented)).toEqual(toScenarioSnapshot(session, scenario))
  })
})

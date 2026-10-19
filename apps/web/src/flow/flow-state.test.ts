import { describe, expect, it } from 'vitest'
import type { PublicScenarioSummary } from '@gami/shared'
import {
  INITIAL_FLOW_STATE,
  flowReducer,
  type FlowEvent,
  type FlowResume,
  type FlowState,
} from './flow-state'

const villa: PublicScenarioSummary = {
  scenarioId: 'scenario_villa',
  name: 'Villa',
  presentation: { entryQuestion: { prompt: 'Who are you?', personaField: 'name' } },
}
const museum: PublicScenarioSummary = { scenarioId: 'scenario_museum', name: 'Museum' }

function run(events: FlowEvent[], from: FlowState = INITIAL_FLOW_STATE): FlowState {
  return events.reduce(flowReducer, from)
}

function loaded(scenarios: PublicScenarioSummary[], resume: FlowResume | null = null): FlowEvent {
  return { type: 'scenariosLoaded', scenarios, resume }
}

describe('guided flow', () => {
  it('skips the picker for a single active scenario', () => {
    expect(run([loaded([villa])])).toMatchObject({ step: 'landing', scenario: villa })
  })

  it('asks the visitor to pick when several scenarios are active', () => {
    const state = run([
      loaded([villa, museum]),
      { type: 'scenarioPicked', scenarioId: 'scenario_museum' },
    ])
    expect(state).toMatchObject({ step: 'landing', scenario: museum })
    expect(run([{ type: 'back' }], state)).toMatchObject({ step: 'scenarioPicker', scenario: null })
  })

  it('shows the picker empty state when nothing is active', () => {
    expect(run([loaded([])]).step).toBe('scenarioPicker')
  })

  it('walks landing → intro → entry question → character choice → conversation → outro', () => {
    const steps = [
      loaded([villa]),
      { type: 'begin' },
      { type: 'introFinished' },
      { type: 'entryQuestionFinished' },
      { type: 'conversationStarted' },
      { type: 'conversationEnded' },
    ] satisfies FlowEvent[]
    const visited = steps.map((_, index) => run(steps.slice(0, index + 1)).step)
    expect(visited).toEqual([
      'landing',
      'intro',
      'entryQuestion',
      'characterChoice',
      'conversation',
      'outro',
    ])
  })

  it('skips the entry question when none is authored', () => {
    expect(run([loaded([museum]), { type: 'begin' }, { type: 'introFinished' }]).step).toBe(
      'characterChoice',
    )
  })

  it('goes back one step at a time before the conversation', () => {
    const atChoice = run([
      loaded([villa]),
      { type: 'begin' },
      { type: 'introFinished' },
      { type: 'entryQuestionFinished' },
    ])
    expect(run([{ type: 'back' }], atChoice).step).toBe('entryQuestion')
    expect(run([{ type: 'back' }, { type: 'back' }], atChoice).step).toBe('intro')
    expect(run([{ type: 'back' }, { type: 'back' }, { type: 'back' }], atChoice).step).toBe(
      'landing',
    )
    expect(run([loaded([villa]), { type: 'back' }]).step).toBe('landing')
  })

  it('returns to character choice on switch or when the conversation is lost', () => {
    const inConversation = run([
      loaded([villa], { scenarioId: 'scenario_villa', hasConversation: true }),
    ])
    expect(inConversation.step).toBe('conversation')
    expect(run([{ type: 'switchCharacter' }], inConversation).step).toBe('characterChoice')
    expect(run([{ type: 'conversationLost' }], inConversation).step).toBe('characterChoice')
  })

  it('resumes to landing for a known scenario without a live conversation', () => {
    expect(
      run([loaded([villa, museum], { scenarioId: 'scenario_museum', hasConversation: false })]),
    ).toMatchObject({ step: 'landing', scenario: museum })
  })

  it('ignores a remembered scenario that is no longer active', () => {
    expect(
      run([loaded([villa, museum], { scenarioId: 'scenario_gone', hasConversation: true })]).step,
    ).toBe('scenarioPicker')
  })

  it('restarts from the outro on the same scenario', () => {
    const outro: FlowState = { step: 'outro', scenarios: [villa], scenario: villa }
    expect(run([{ type: 'restart' }], outro)).toMatchObject({ step: 'landing', scenario: villa })
  })

  it('moves to the error step on load failure and back to loading on retry', () => {
    const failed = run([{ type: 'loadFailed' }])
    expect(failed.step).toBe('error')
    expect(run([{ type: 'retry' }], failed)).toEqual(INITIAL_FLOW_STATE)
  })

  it('ignores events that do not apply to the current step', () => {
    const landing = run([loaded([villa])])
    expect(
      run([{ type: 'conversationEnded' }, { type: 'restart' }, { type: 'retry' }], landing),
    ).toEqual(landing)
  })
})

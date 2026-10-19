import type { PublicScenarioSummary } from '@gami/shared'

export type FlowStep =
  | 'loading'
  | 'error'
  | 'scenarioPicker'
  | 'landing'
  | 'intro'
  | 'entryQuestion'
  | 'characterChoice'
  | 'conversation'
  | 'outro'

export type FlowState = {
  step: FlowStep
  scenarios: PublicScenarioSummary[]
  scenario: PublicScenarioSummary | null
}

/** What the browser remembers from a previous visit. */
export type FlowResume = {
  scenarioId: string
  hasConversation: boolean
}

export type FlowEvent =
  | { type: 'scenariosLoaded'; scenarios: PublicScenarioSummary[]; resume: FlowResume | null }
  | { type: 'loadFailed' }
  | { type: 'retry' }
  | { type: 'scenarioPicked'; scenarioId: string }
  | { type: 'begin' }
  | { type: 'introFinished' }
  | { type: 'entryQuestionFinished' }
  | { type: 'back' }
  | { type: 'conversationStarted' }
  | { type: 'conversationLost' }
  | { type: 'switchCharacter' }
  | { type: 'conversationEnded' }
  | { type: 'restart' }

export const INITIAL_FLOW_STATE: FlowState = { step: 'loading', scenarios: [], scenario: null }

/** Events that only move between two fixed steps. */
const STEP_TRANSITIONS: Partial<Record<FlowEvent['type'], { from: FlowStep; to: FlowStep }>> = {
  loadFailed: { from: 'loading', to: 'error' },
  begin: { from: 'landing', to: 'intro' },
  entryQuestionFinished: { from: 'entryQuestion', to: 'characterChoice' },
  conversationStarted: { from: 'characterChoice', to: 'conversation' },
  conversationLost: { from: 'conversation', to: 'characterChoice' },
  switchCharacter: { from: 'conversation', to: 'characterChoice' },
  conversationEnded: { from: 'conversation', to: 'outro' },
  restart: { from: 'outro', to: 'landing' },
}

export function flowReducer(state: FlowState, event: FlowEvent): FlowState {
  switch (event.type) {
    case 'scenariosLoaded':
      return state.step === 'loading' ? fromLoadedScenarios(event.scenarios, event.resume) : state
    case 'retry':
      return state.step === 'error' ? INITIAL_FLOW_STATE : state
    case 'scenarioPicked':
      return pickScenario(state, event.scenarioId)
    case 'introFinished':
      return transition(
        state,
        'intro',
        hasEntryQuestion(state) ? 'entryQuestion' : 'characterChoice',
      )
    case 'back':
      return goBack(state)
    default: {
      const step = STEP_TRANSITIONS[event.type]
      return step === undefined ? state : transition(state, step.from, step.to)
    }
  }
}

function fromLoadedScenarios(
  scenarios: PublicScenarioSummary[],
  resume: FlowResume | null,
): FlowState {
  const resumed = scenarios.find((scenario) => scenario.scenarioId === resume?.scenarioId)
  if (resumed !== undefined) {
    return {
      step: resume?.hasConversation === true ? 'conversation' : 'landing',
      scenarios,
      scenario: resumed,
    }
  }
  const only = scenarios.length === 1 ? scenarios[0] : undefined
  if (only !== undefined) return { step: 'landing', scenarios, scenario: only }
  return { step: 'scenarioPicker', scenarios, scenario: null }
}

function pickScenario(state: FlowState, scenarioId: string): FlowState {
  if (state.step !== 'scenarioPicker') return state
  const scenario = state.scenarios.find((item) => item.scenarioId === scenarioId)
  return scenario === undefined ? state : { ...state, step: 'landing', scenario }
}

function goBack(state: FlowState): FlowState {
  switch (state.step) {
    case 'landing':
      return state.scenarios.length > 1
        ? { ...state, step: 'scenarioPicker', scenario: null }
        : state
    case 'intro':
      return { ...state, step: 'landing' }
    case 'entryQuestion':
      return { ...state, step: 'intro' }
    case 'characterChoice':
      return { ...state, step: hasEntryQuestion(state) ? 'entryQuestion' : 'intro' }
    default:
      return state
  }
}

function transition(state: FlowState, from: FlowStep, to: FlowStep): FlowState {
  return state.step === from ? { ...state, step: to } : state
}

function hasEntryQuestion(state: FlowState): boolean {
  return state.scenario?.presentation?.entryQuestion !== undefined
}

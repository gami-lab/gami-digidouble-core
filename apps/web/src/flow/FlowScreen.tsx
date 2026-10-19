import type { JSX } from 'react'
import type { PublicScenarioSummary } from '@gami/shared'
import { ConversationScreen } from '../conversation/ConversationScreen'
import type { ActiveChatRuntimeState } from '../chat/use-active-chat-runtime'
import type { ScenarioAvatarDiscoveryState } from '../discovery/use-scenario-avatar-discovery'
import { CharacterChoiceScreen } from './CharacterChoiceScreen'
import { EntryQuestionScreen } from './EntryQuestionScreen'
import type { FlowEvent, FlowState, FlowStep } from './flow-state'
import {
  ErrorScreen,
  IntroScreen,
  LandingScreen,
  LoadingScreen,
  OutroScreen,
  ScenarioPickerScreen,
} from './StoryScreens'

type FlowScreenProps = {
  flow: FlowState
  dispatch: (event: FlowEvent) => void
  discovery: ScenarioAvatarDiscoveryState
  chat: ActiveChatRuntimeState
}

type ScenarioScreenProps = FlowScreenProps & { scenario: PublicScenarioSummary }

type ScenarioStep = Exclude<FlowStep, 'loading' | 'error' | 'scenarioPicker'>

const SCENARIO_SCREENS: Record<ScenarioStep, (props: ScenarioScreenProps) => JSX.Element> = {
  landing: ({ scenario, flow, dispatch }) => (
    <LandingScreen
      scenario={scenario}
      onNext={() => {
        dispatch({ type: 'begin' })
      }}
      onBack={flow.scenarios.length > 1 ? back(dispatch) : undefined}
    />
  ),
  intro: ({ scenario, dispatch }) => (
    <IntroScreen
      scenario={scenario}
      onNext={() => {
        dispatch({ type: 'introFinished' })
      }}
      onBack={back(dispatch)}
    />
  ),
  entryQuestion: ({ scenario, dispatch }) => {
    const question = scenario.presentation?.entryQuestion
    if (question === undefined) return <LoadingScreen />
    return (
      <EntryQuestionScreen
        scenario={scenario}
        question={question}
        onDone={() => {
          dispatch({ type: 'entryQuestionFinished' })
        }}
        onBack={back(dispatch)}
      />
    )
  },
  characterChoice: ({ scenario, discovery, chat, dispatch }) => (
    <CharacterChoiceScreen
      scenario={scenario}
      avatars={discovery.avatars}
      loading={discovery.avatarStatus === 'loading'}
      error={chat.conversationError ?? discovery.avatarError}
      onChoose={(avatarId, firstMessage) => {
        chat.startChatWithAvatar(avatarId, firstMessage)
        dispatch({ type: 'conversationStarted' })
      }}
      onBack={back(dispatch)}
    />
  ),
  conversation: ({ scenario, discovery, chat, dispatch }) => (
    <ConversationScreen
      avatar={
        discovery.avatars.find((item) => item.avatarId === chat.activeAvatarId) ?? {
          name: scenario.name,
        }
      }
      chat={chat}
      onSwitch={() => {
        chat.stopMessageAudio()
        dispatch({ type: 'switchCharacter' })
      }}
    />
  ),
  outro: ({ scenario, discovery, dispatch }) => (
    <OutroScreen
      scenario={scenario}
      onNext={() => {
        discovery.restartSession()
        dispatch({ type: 'restart' })
      }}
    />
  ),
}

export function FlowScreen(props: FlowScreenProps): JSX.Element {
  const { flow, dispatch, discovery } = props
  if (flow.step === 'error') {
    return (
      <ErrorScreen
        onRetry={() => {
          dispatch({ type: 'retry' })
          discovery.reloadScenarios()
        }}
      />
    )
  }
  if (flow.step === 'scenarioPicker') {
    return (
      <ScenarioPickerScreen
        scenarios={flow.scenarios}
        onPick={(scenarioId) => {
          dispatch({ type: 'scenarioPicked', scenarioId })
        }}
      />
    )
  }
  if (flow.step === 'loading' || flow.scenario === null) return <LoadingScreen />
  return SCENARIO_SCREENS[flow.step]({ ...props, scenario: flow.scenario })
}

function back(dispatch: (event: FlowEvent) => void): () => void {
  return () => {
    dispatch({ type: 'back' })
  }
}

import { useEffect, useMemo, useReducer, useRef } from 'react'
import type { JSX } from 'react'
import { useActiveChatRuntime, type ActiveChatRuntimeState } from '../chat/use-active-chat-runtime'
import {
  useScenarioAvatarDiscovery,
  type ScenarioAvatarDiscoveryState,
} from '../discovery/use-scenario-avatar-discovery'
import {
  persistLocalWebRuntimeState,
  readLocalWebRuntimeState,
} from '../runtime/local-runtime-state'
import { FlowScreen } from './FlowScreen'
import { INITIAL_FLOW_STATE, flowReducer, type FlowEvent, type FlowState } from './flow-state'

type Dispatch = (event: FlowEvent) => void

export function GuidedExperience({ userId }: { userId: string }): JSX.Element {
  const remembered = useMemo(() => readLocalWebRuntimeState(userId), [userId])
  const [flow, dispatch] = useReducer(flowReducer, INITIAL_FLOW_STATE)
  const discovery = useScenarioAvatarDiscovery(userId, {
    initialSelectedScenarioId: remembered?.selectedScenarioId ?? null,
  })
  const chat = useActiveChatRuntime(discovery.session, {
    initialActiveAvatarId: remembered?.activeAvatarId ?? null,
    initialConversationId: remembered?.conversationId ?? null,
  })
  const endRequestedRef = useRef(false)

  useLoadedScenarios(discovery, remembered, dispatch)
  useSelectedScenario(flow, discovery)
  useConversationOutcome(flow, chat, discovery.sessionClosed, endRequestedRef, dispatch)
  useEffect(() => {
    persistLocalWebRuntimeState({
      version: 1,
      userId,
      selectedScenarioId: discovery.selectedScenarioId,
      activeAvatarId: chat.activeAvatarId,
      conversationId: chat.conversation?.conversationId ?? null,
      updatedAt: new Date().toISOString(),
    })
  }, [userId, discovery.selectedScenarioId, chat.activeAvatarId, chat.conversation?.conversationId])

  return (
    <FlowScreen
      flow={flow}
      dispatch={dispatch}
      discovery={discovery}
      chat={{
        ...chat,
        endCurrentConversation: () => {
          endRequestedRef.current = true
          chat.endCurrentConversation()
        },
      }}
    />
  )
}

function useLoadedScenarios(
  discovery: ScenarioAvatarDiscoveryState,
  remembered: ReturnType<typeof readLocalWebRuntimeState>,
  dispatch: Dispatch,
): void {
  const { scenarioStatus, scenarios } = discovery
  useEffect(() => {
    if (scenarioStatus === 'error') dispatch({ type: 'loadFailed' })
    if (scenarioStatus !== 'ready') return
    const scenarioId = remembered?.selectedScenarioId ?? null
    dispatch({
      type: 'scenariosLoaded',
      scenarios,
      resume:
        scenarioId === null
          ? null
          : { scenarioId, hasConversation: remembered?.conversationId != null },
    })
  }, [scenarioStatus, scenarios, remembered, dispatch])
}

function useSelectedScenario(flow: FlowState, discovery: ScenarioAvatarDiscoveryState): void {
  const scenarioId = flow.scenario?.scenarioId ?? null
  const { selectedScenarioId, selectScenario } = discovery
  useEffect(() => {
    if (scenarioId !== null && scenarioId !== selectedScenarioId) selectScenario(scenarioId)
  }, [scenarioId, selectedScenarioId, selectScenario])
}

/**
 * Leaves the conversation step once the conversation closes: to the outro when the visitor ended
 * it or Core closed the session, back to character choice when it could not be started or resumed.
 */
function useConversationOutcome(
  flow: FlowState,
  chat: ActiveChatRuntimeState,
  sessionClosed: boolean,
  endRequestedRef: { current: boolean },
  dispatch: Dispatch,
): void {
  const inConversation = flow.step === 'conversation'
  const { conversation, conversationStatus, conversationError } = chat
  useEffect(() => {
    if (!inConversation) return
    if (sessionClosed) {
      dispatch({ type: 'conversationEnded' })
      return
    }
    if (conversation !== null || conversationStatus === 'starting') return
    if (endRequestedRef.current && conversationStatus === 'idle') {
      endRequestedRef.current = false
      dispatch({ type: 'conversationEnded' })
    } else if (conversationStatus === 'error' || conversationError !== null) {
      dispatch({ type: 'conversationLost' })
    }
  }, [
    inConversation,
    sessionClosed,
    conversation,
    conversationStatus,
    conversationError,
    endRequestedRef,
    dispatch,
  ])
}

import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  AdminSessionInspectResponse,
  AvatarSummary,
  ConversationSummary,
  Message,
  ScenarioSummary,
} from '@gami/shared'
import { listKnowledgeSources } from '../../api/knowledge'
import { subscribeToRuntimeEvents } from '../../api/runtime-events-stream'
import { getScenario, listScenarioAvatars } from '../../api/scenarios'
import {
  getHistory,
  inspectSession,
  listSessionConversations,
  listSessionEvents,
} from '../../api/sessions'
import { buildSessionTimeline, type TimelineEntry } from '../../debug/session-timeline'
import { useAsync } from '../../ui/use-async'

export type SessionData = {
  inspect: AdminSessionInspectResponse['inspect']
  scenario: ScenarioSummary
  avatars: AvatarSummary[]
  sourceNames: Record<string, string>
  conversations: ConversationSummary[]
  timeline: TimelineEntry[]
}

export type SessionDataState = {
  data: SessionData | null
  error: string | null
  isLoading: boolean
  isProcessing: boolean
  isLive: boolean
  reload: () => void
}

const LIVE_RELOAD_DELAY_MS = 400

export function useSessionData(sessionId: string): SessionDataState {
  const state = useAsync(() => loadSessionData(sessionId), [sessionId])
  const live = useLiveReload(sessionId, state.reload)
  return { ...state, ...live }
}

async function loadSessionData(sessionId: string): Promise<SessionData> {
  const [{ inspect }, eventsResponse, conversations] = await Promise.all([
    inspectSession(sessionId),
    listSessionEvents(sessionId),
    listSessionConversations(sessionId),
  ])
  const scenarioId = inspect.session.scenarioId
  const [scenario, avatars, sources, histories] = await Promise.all([
    getScenario(scenarioId),
    listScenarioAvatars(scenarioId),
    listKnowledgeSources(scenarioId),
    Promise.all(conversations.map((conversation) => getHistory(conversation.conversationId))),
  ])
  const messagesByConversation: Record<string, Message[]> = Object.fromEntries(
    histories.map((history) => [history.conversation.conversationId, history.messages]),
  )
  return {
    inspect,
    scenario,
    avatars,
    sourceNames: Object.fromEntries(
      sources.sources.map((source) => [source.sourceId, source.name]),
    ),
    conversations,
    timeline: buildSessionTimeline(eventsResponse.events, messagesByConversation),
  }
}

// Turns, GM runs, and memory work land asynchronously; any runtime event triggers a debounced
// reload so the timeline follows sessions driven from the web app.
function useLiveReload(
  sessionId: string,
  reload: () => void,
): { isLive: boolean; isProcessing: boolean } {
  const [isLive, setIsLive] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const timerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    setIsLive(true)
    const subscription = subscribeToRuntimeEvents(sessionId, {
      onEvent: (event) => {
        if (event.type === 'runtime.processing_started') setIsProcessing(true)
        if (event.type === 'runtime.processing_finished') setIsProcessing(false)
        window.clearTimeout(timerRef.current)
        timerRef.current = window.setTimeout(reload, LIVE_RELOAD_DELAY_MS)
      },
      onError: () => {
        setIsLive(false)
      },
    })
    return () => {
      window.clearTimeout(timerRef.current)
      subscription.close()
    }
  }, [sessionId, reload])

  return useMemo(() => ({ isLive, isProcessing }), [isLive, isProcessing])
}

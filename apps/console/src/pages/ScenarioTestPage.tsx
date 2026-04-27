import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, JSX, SetStateAction, SyntheticEvent } from 'react'
import {
  getAvailableAvatars,
  getHistory,
  listScenarioAvatars,
  listSessionConversations,
  sendMessage,
  startSession,
  switchAvatar,
} from '../api'
import type { AvailableAvatarSummary, ConversationSummary, ScenarioSummary } from '../api'
import { formatApiError } from '../api/error'
import { ScenarioTestLayout } from '../components/ScenarioTestLayout'
import {
  createInitialScenarioTestState,
  deriveAvatarAvailabilityEntries,
  deriveConversationTimeline,
  withAllScenarioAvatars,
  withAvailableAvatarsRefreshed,
  withConversationAdded,
  withConversationHistoryLoaded,
  withError,
  withErrorCleared,
  withMessageExchangeAppended,
  withSessionStarted,
} from './scenario-test-state'
import type { ScenarioTestState } from './scenario-test-state'

type ScenarioTestPageProps = { scenario: ScenarioSummary }
type SetScenarioTestState = Dispatch<SetStateAction<ScenarioTestState>>

function avatarIds(avatars: AvailableAvatarSummary[]): string[] {
  return avatars.map((avatar) => avatar.avatarId)
}

async function loadScenarioAvatars(
  scenarioId: string,
  setState: SetScenarioTestState,
): Promise<void> {
  try {
    const avatars = await listScenarioAvatars(scenarioId)
    setState((prev) => withAllScenarioAvatars(prev, avatars))
  } catch (error) {
    setState((prev) => withError(prev, formatApiError(error, 'Failed to load avatars')))
  }
}

async function startSessionFlow(
  userId: string,
  scenarioId: string,
  setState: SetScenarioTestState,
  turnIndexRef: { current: number },
): Promise<void> {
  const session = await startSession({ userId, scenarioId })
  const available = await getAvailableAvatars(session.sessionId)
  const conversations = await listSessionConversations(session.sessionId)
  setState((prev) => ({
    ...withSessionStarted(prev, session, avatarIds(available.avatars)),
    conversations,
  }))
  turnIndexRef.current = 0
}

async function switchAvatarFlow(
  sessionId: string,
  avatarId: string,
  setState: SetScenarioTestState,
  turnIndexRef: { current: number },
  allAvatarsById: Map<string, AvailableAvatarSummary>,
): Promise<void> {
  const result = await switchAvatar(sessionId, avatarId)
  const available = await getAvailableAvatars(sessionId)
  setState((prev) =>
    withAvailableAvatarsRefreshed(
      withConversationAdded(prev, result.conversation, result.session, true),
      avatarIds(available.avatars),
      result.session,
      prev.availableAvatarIds,
      turnIndexRef.current,
      allAvatarsById,
    ),
  )
}

async function sendMessageFlow(
  conversationId: string,
  content: string,
  sessionId: string,
  setState: SetScenarioTestState,
  turnIndexRef: { current: number },
  allAvatarsById: Map<string, AvailableAvatarSummary>,
): Promise<void> {
  const response = await sendMessage(conversationId, { message: { content } })
  turnIndexRef.current += 1
  const available = await getAvailableAvatars(sessionId)
  setState((prev) =>
    withMessageExchangeAppended(
      withAvailableAvatarsRefreshed(
        prev,
        avatarIds(available.avatars),
        response.session,
        prev.availableAvatarIds,
        turnIndexRef.current,
        allAvatarsById,
      ),
      conversationId,
      response.conversation,
      response.userMessage,
      response.avatarMessage,
      response.session,
    ),
  )
}

async function openConversationFlow(
  conversationId: string,
  setState: SetScenarioTestState,
): Promise<void> {
  const history = await getHistory(conversationId)
  setState((prev) =>
    withConversationHistoryLoaded(prev, conversationId, history.messages, history.conversation),
  )
}

function useScenarioDerivedData(state: ScenarioTestState): {
  allAvatarsById: Map<string, AvailableAvatarSummary>
  availabilityEntries: ReturnType<typeof deriveAvatarAvailabilityEntries>
  timelineEntries: ReturnType<typeof deriveConversationTimeline>
  selectedMessages: ScenarioTestState['messagesByConversationId'][string]
  selectedConversation: ConversationSummary | null
  availableAvatarsForInspector: AvailableAvatarSummary[]
} {
  const allAvatarsById = useMemo(
    () => new Map(state.allScenarioAvatars.map((a) => [a.avatarId, a])),
    [state.allScenarioAvatars],
  )
  const availabilityEntries = useMemo(() => deriveAvatarAvailabilityEntries(state), [state])
  const timelineEntries = useMemo(
    () => deriveConversationTimeline(state, allAvatarsById),
    [state, allAvatarsById],
  )
  const selectedMessages = useMemo(
    () =>
      state.selectedConversationId
        ? (state.messagesByConversationId[state.selectedConversationId] ?? [])
        : [],
    [state.selectedConversationId, state.messagesByConversationId],
  )
  const selectedConversation = useMemo(
    () =>
      state.selectedConversationId
        ? (state.conversations.find((c) => c.conversationId === state.selectedConversationId) ??
          null)
        : null,
    [state.selectedConversationId, state.conversations],
  )
  const availableAvatarsForInspector = useMemo(
    () => state.allScenarioAvatars.filter((a) => state.availableAvatarIds.includes(a.avatarId)),
    [state.allScenarioAvatars, state.availableAvatarIds],
  )
  return {
    allAvatarsById,
    availabilityEntries,
    timelineEntries,
    selectedMessages,
    selectedConversation,
    availableAvatarsForInspector,
  }
}

function useAuxiliaryHandlers(
  state: ScenarioTestState,
  draftMessage: string,
  setDraftMessage: Dispatch<SetStateAction<string>>,
  setState: SetScenarioTestState,
  handleSendMessage: (content: string) => void,
  handleSwitchAvatar: (avatarId: string) => void,
): {
  handleSendDraft: (event: SyntheticEvent<HTMLFormElement>) => void
  handleReturnToGuide: () => void
  handleTestLockedAccess: () => void
} {
  const handleSendDraft = useCallback(
    (event: SyntheticEvent<HTMLFormElement>): void => {
      event.preventDefault()
      const content = draftMessage.trim()
      if (content.length === 0) return
      setDraftMessage('')
      handleSendMessage(content)
    },
    [draftMessage, handleSendMessage, setDraftMessage],
  )

  const handleReturnToGuide = useCallback((): void => {
    const firstAvailable = state.availableAvatarIds[0]
    if (firstAvailable && firstAvailable !== state.session?.activeAvatarId) {
      handleSwitchAvatar(firstAvailable)
    }
  }, [handleSwitchAvatar, state.availableAvatarIds, state.session?.activeAvatarId])

  const handleTestLockedAccess = useCallback((): void => {
    const locked = state.allScenarioAvatars.find(
      (a) => !state.availableAvatarIds.includes(a.avatarId),
    )
    if (locked && state.session) {
      handleSwitchAvatar(locked.avatarId)
      return
    }
    setState((prev) =>
      withError(prev, 'No locked avatars found. All avatars may already be unlocked.'),
    )
  }, [
    handleSwitchAvatar,
    setState,
    state.allScenarioAvatars,
    state.availableAvatarIds,
    state.session,
  ])

  return { handleSendDraft, handleReturnToGuide, handleTestLockedAccess }
}

// eslint-disable-next-line max-lines-per-function
export function ScenarioTestPage({ scenario }: ScenarioTestPageProps): JSX.Element {
  const [state, setState] = useState<ScenarioTestState>(createInitialScenarioTestState)
  const [userId, setUserId] = useState('tester')
  const [draftMessage, setDraftMessage] = useState('')
  const [isStartingSession, setIsStartingSession] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const turnIndexRef = useRef(0)

  const {
    allAvatarsById,
    availabilityEntries,
    timelineEntries,
    selectedMessages,
    selectedConversation,
    availableAvatarsForInspector,
  } = useScenarioDerivedData(state)

  useEffect(() => {
    void loadScenarioAvatars(scenario.scenarioId, setState)
  }, [scenario.scenarioId])

  const handleStartSession = useCallback((): void => {
    setIsStartingSession(true)
    setState((prev) => withErrorCleared(prev))
    void (async () => {
      try {
        await startSessionFlow(userId, scenario.scenarioId, setState, turnIndexRef)
      } catch (error) {
        setState((prev) => withError(prev, formatApiError(error, 'Failed to start session')))
      } finally {
        setIsStartingSession(false)
      }
    })()
  }, [scenario.scenarioId, userId])

  const handleSwitchAvatar = useCallback(
    (avatarId: string): void => {
      if (state.session === null) return
      const sessionId = state.session.sessionId
      setIsSwitching(true)
      setState((prev) => withErrorCleared(prev))
      void (async () => {
        try {
          await switchAvatarFlow(sessionId, avatarId, setState, turnIndexRef, allAvatarsById)
        } catch (error) {
          setState((prev) => withError(prev, formatApiError(error, 'Failed to switch avatar')))
        } finally {
          setIsSwitching(false)
        }
      })()
    },
    [allAvatarsById, state.session],
  )

  const handleSendMessage = useCallback(
    (content: string): void => {
      if (!state.selectedConversationId || !state.session || content.trim() === '') return
      const conversationId = state.selectedConversationId
      const sessionId = state.session.sessionId
      setIsSending(true)
      setState((prev) => withErrorCleared(prev))
      void (async () => {
        try {
          await sendMessageFlow(
            conversationId,
            content,
            sessionId,
            setState,
            turnIndexRef,
            allAvatarsById,
          )
        } catch (error) {
          setState((prev) => withError(prev, formatApiError(error, 'Failed to send message')))
        } finally {
          setIsSending(false)
        }
      })()
    },
    [allAvatarsById, state.selectedConversationId, state.session],
  )

  const handleOpenConversation = useCallback((conversation: ConversationSummary): void => {
    setIsLoadingHistory(true)
    void (async () => {
      try {
        await openConversationFlow(conversation.conversationId, setState)
      } catch (error) {
        setState((prev) =>
          withError(prev, formatApiError(error, 'Failed to load conversation history')),
        )
      } finally {
        setIsLoadingHistory(false)
      }
    })()
  }, [])

  const { handleSendDraft, handleReturnToGuide, handleTestLockedAccess } = useAuxiliaryHandlers(
    state,
    draftMessage,
    setDraftMessage,
    setState,
    handleSendMessage,
    handleSwitchAvatar,
  )

  return (
    <ScenarioTestLayout
      scenario={scenario}
      state={state}
      userId={userId}
      draftMessage={draftMessage}
      isStartingSession={isStartingSession}
      isSwitching={isSwitching}
      isSending={isSending}
      isLoadingHistory={isLoadingHistory}
      availabilityEntries={availabilityEntries}
      timelineEntries={timelineEntries}
      selectedConversation={selectedConversation}
      selectedMessages={selectedMessages}
      availableAvatarsForInspector={availableAvatarsForInspector}
      allAvatarsById={allAvatarsById}
      onUserIdChange={setUserId}
      onStartSession={handleStartSession}
      onSwitchAvatar={handleSwitchAvatar}
      onSendMessage={handleSendMessage}
      onSendDraft={handleSendDraft}
      onDraftChange={setDraftMessage}
      onOpenConversation={handleOpenConversation}
      onReturnToGuide={handleReturnToGuide}
      onTestLockedAccess={handleTestLockedAccess}
    />
  )
}

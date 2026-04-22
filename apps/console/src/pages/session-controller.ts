import { useEffect, useMemo, useState } from 'react'
import type { ComponentProps, Dispatch, SetStateAction } from 'react'
import {
  getHistory,
  getSession,
  listScenarioAvatars,
  listSessionConversations,
  sendMessage,
  startConversation,
  startSession,
} from '../api'
import type {
  AvatarSummary,
  ConversationSummary,
  Message,
  ScenarioSummary,
  SessionSummary,
} from '../api'
import { formatApiError } from '../api/error'
import {
  addOrUpdateConversation,
  appendConversationExchange,
  countAvatarConversations,
  createInitialSessionConsoleState,
  replaceSessionConversations,
  selectConversation,
  setConversationHistory,
  withSession,
} from './session-state'
import type { SessionConsoleState } from './session-state'

type FormSubmitEvent = Parameters<NonNullable<ComponentProps<'form'>['onSubmit']>>[0]

type SessionControllerState = {
  userId: string
  setUserId: (value: string) => void
  draftMessage: string
  setDraftMessage: (value: string) => void
  avatars: AvatarSummary[]
  setAvatars: (avatars: AvatarSummary[]) => void
  selectedAvatarId: string | null
  setSelectedAvatarId: (value: string | null) => void
  state: SessionConsoleState
  setState: Dispatch<SetStateAction<SessionConsoleState>>
  submitError: string | null
  setSubmitError: (value: string | null) => void
  isLoadingAvatars: boolean
  setIsLoadingAvatars: (value: boolean) => void
  isLoadingSession: boolean
  setIsLoadingSession: (value: boolean) => void
  isStartingSession: boolean
  setIsStartingSession: (value: boolean) => void
  isStartingConversation: boolean
  setIsStartingConversation: (value: boolean) => void
  isLoadingConversation: boolean
  setIsLoadingConversation: (value: boolean) => void
  isSendingMessage: boolean
  setIsSendingMessage: (value: boolean) => void
  activeSessionId: string | null
  avatarsById: Map<string, AvatarSummary>
  selectedConversation: ConversationSummary | null
  selectedMessages: Message[]
  startConversationButtonLabel: string
}

export type SessionPageController = {
  activeSessionId: string | null
  userId: string
  setUserId: (value: string) => void
  draftMessage: string
  setDraftMessage: (value: string) => void
  avatars: AvatarSummary[]
  avatarsById: Map<string, AvatarSummary>
  selectedAvatarId: string | null
  setSelectedAvatarId: (value: string | null) => void
  selectedConversation: ConversationSummary | null
  selectedMessages: Message[]
  state: SessionConsoleState
  isLoadingSession: boolean
  isLoadingAvatars: boolean
  isStartingSession: boolean
  isStartingConversation: boolean
  isLoadingConversation: boolean
  isSendingMessage: boolean
  submitError: string | null
  startConversationButtonLabel: string
  handleStartSessionSubmit: (event: FormSubmitEvent) => void
  handleStartConversation: () => void
  openPreviousConversation: (conversation: ConversationSummary) => void
  handleSendMessageSubmit: (event: FormSubmitEvent) => void
}

export function useSessionPageController(
  scenario: ScenarioSummary,
  initialAvatar: AvatarSummary | null,
  sessionId: string | null,
  onSessionIdChange: (sessionId: string | null) => void,
  onSessionStarted?: (session: SessionSummary) => void,
): SessionPageController {
  const ui = useSessionControllerState(initialAvatar, sessionId)

  useEffect(() => {
    void loadAvatars(scenario.scenarioId, ui.setAvatars, ui.setIsLoadingAvatars, ui.setSubmitError)
  }, [scenario.scenarioId, ui.setAvatars, ui.setIsLoadingAvatars, ui.setSubmitError])

  useEffect(() => {
    if (ui.activeSessionId === null) {
      ui.setState(createInitialSessionConsoleState())
      return
    }

    void hydrateSessionState(
      ui.activeSessionId,
      ui.setState,
      ui.setIsLoadingSession,
      ui.setSubmitError,
      ui.setSelectedAvatarId,
    )
  }, [
    ui.activeSessionId,
    ui.setState,
    ui.setIsLoadingSession,
    ui.setSubmitError,
    ui.setSelectedAvatarId,
  ])

  return {
    ...ui,
    handleStartSessionSubmit: buildStartSessionHandler(
      scenario,
      ui.userId,
      onSessionIdChange,
      ui.setSubmitError,
      ui.setIsStartingSession,
      ui.setState,
      onSessionStarted,
    ),
    handleStartConversation: buildStartConversationHandler(
      ui.activeSessionId,
      ui.selectedAvatarId,
      ui.setSubmitError,
      ui.setIsStartingConversation,
      ui.setState,
    ),
    openPreviousConversation: buildOpenConversationHandler(
      ui.setSubmitError,
      ui.setIsLoadingConversation,
      ui.setState,
    ),
    handleSendMessageSubmit: buildSendMessageHandler(
      ui.state.selectedConversationId,
      ui.draftMessage,
      ui.setSubmitError,
      ui.setDraftMessage,
      ui.setIsSendingMessage,
      ui.setState,
    ),
  }
}

function useSessionControllerState(
  initialAvatar: AvatarSummary | null,
  sessionId: string | null,
): SessionControllerState {
  const [userId, setUserId] = useState('')
  const [avatars, setAvatars] = useState<AvatarSummary[]>([])
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(
    initialAvatar?.avatarId ?? null,
  )
  const [draftMessage, setDraftMessage] = useState('')
  const [state, setState] = useState<SessionConsoleState>(createInitialSessionConsoleState)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isLoadingAvatars, setIsLoadingAvatars] = useState(false)
  const [isLoadingSession, setIsLoadingSession] = useState(false)
  const [isStartingSession, setIsStartingSession] = useState(false)
  const [isStartingConversation, setIsStartingConversation] = useState(false)
  const [isLoadingConversation, setIsLoadingConversation] = useState(false)
  const [isSendingMessage, setIsSendingMessage] = useState(false)

  const activeSessionId = state.session?.sessionId ?? sessionId
  const avatarsById = useMemo(() => toAvatarMap(avatars), [avatars])
  const selectedConversation = useMemo(
    () =>
      state.conversations.find(
        (conversation) => conversation.conversationId === state.selectedConversationId,
      ) ?? null,
    [state.conversations, state.selectedConversationId],
  )

  const selectedMessages =
    state.selectedConversationId === null
      ? []
      : (state.messagesByConversationId[state.selectedConversationId] ?? [])

  const startConversationButtonLabel = useMemo(() => {
    if (selectedAvatarId === null) {
      return 'Start conversation with avatar'
    }

    return countAvatarConversations(state.conversations, selectedAvatarId) > 0
      ? 'Start new conversation with this avatar'
      : 'Start conversation with avatar'
  }, [selectedAvatarId, state.conversations])

  return {
    userId,
    setUserId,
    draftMessage,
    setDraftMessage,
    avatars,
    setAvatars,
    selectedAvatarId,
    setSelectedAvatarId,
    state,
    setState,
    submitError,
    setSubmitError,
    isLoadingAvatars,
    setIsLoadingAvatars,
    isLoadingSession,
    setIsLoadingSession,
    isStartingSession,
    setIsStartingSession,
    isStartingConversation,
    setIsStartingConversation,
    isLoadingConversation,
    setIsLoadingConversation,
    isSendingMessage,
    setIsSendingMessage,
    activeSessionId,
    avatarsById,
    selectedConversation,
    selectedMessages,
    startConversationButtonLabel,
  }
}

function buildStartSessionHandler(
  scenario: ScenarioSummary,
  userId: string,
  onSessionIdChange: (sessionId: string | null) => void,
  setSubmitError: (value: string | null) => void,
  setIsStartingSession: (value: boolean) => void,
  setState: Dispatch<SetStateAction<SessionConsoleState>>,
  onSessionStarted?: (session: SessionSummary) => void,
): (event: FormSubmitEvent) => void {
  return (event: FormSubmitEvent): void => {
    event.preventDefault()
    void (async () => {
      setSubmitError(null)
      setIsStartingSession(true)

      try {
        const startedSession = await startSession({ scenarioId: scenario.scenarioId, userId })
        onSessionIdChange(startedSession.sessionId)
        onSessionStarted?.(startedSession)
        setState(withSession(createInitialSessionConsoleState(), startedSession))
      } catch (error) {
        setSubmitError(formatApiError(error, 'UNKNOWN_ERROR: Failed to start session'))
      } finally {
        setIsStartingSession(false)
      }
    })()
  }
}

function buildStartConversationHandler(
  activeSessionId: string | null,
  selectedAvatarId: string | null,
  setSubmitError: (value: string | null) => void,
  setIsStartingConversation: (value: boolean) => void,
  setState: Dispatch<SetStateAction<SessionConsoleState>>,
): () => void {
  return (): void => {
    if (activeSessionId === null || selectedAvatarId === null) {
      return
    }

    void (async () => {
      setSubmitError(null)
      setIsStartingConversation(true)

      try {
        const conversation = await startConversation(activeSessionId, {
          avatarId: selectedAvatarId,
        })
        setState((current) => {
          const withConversation = addOrUpdateConversation(current, conversation, true)
          return setConversationHistory(withConversation, conversation.conversationId, [])
        })
      } catch (error) {
        setSubmitError(formatApiError(error, 'UNKNOWN_ERROR: Failed to start conversation'))
      } finally {
        setIsStartingConversation(false)
      }
    })()
  }
}

function buildOpenConversationHandler(
  setSubmitError: (value: string | null) => void,
  setIsLoadingConversation: (value: boolean) => void,
  setState: Dispatch<SetStateAction<SessionConsoleState>>,
): (conversation: ConversationSummary) => void {
  return (conversation: ConversationSummary): void => {
    void (async () => {
      setSubmitError(null)
      setIsLoadingConversation(true)
      setState((current) => selectConversation(current, conversation.conversationId))

      try {
        const history = await getHistory(conversation.conversationId)
        setState((current) => {
          const withConversation = addOrUpdateConversation(current, history.conversation, true)
          return setConversationHistory(
            withConversation,
            conversation.conversationId,
            history.messages,
          )
        })
      } catch (error) {
        setSubmitError(formatApiError(error, 'UNKNOWN_ERROR: Failed to load conversation history'))
      } finally {
        setIsLoadingConversation(false)
      }
    })()
  }
}

function buildSendMessageHandler(
  selectedConversationId: string | null,
  draftMessage: string,
  setSubmitError: (value: string | null) => void,
  setDraftMessage: (value: string) => void,
  setIsSendingMessage: (value: boolean) => void,
  setState: Dispatch<SetStateAction<SessionConsoleState>>,
): (event: FormSubmitEvent) => void {
  return (event: FormSubmitEvent): void => {
    event.preventDefault()

    if (selectedConversationId === null || draftMessage.trim() === '') {
      return
    }

    const content = draftMessage.trim()
    setSubmitError(null)
    setDraftMessage('')
    setIsSendingMessage(true)

    void (async () => {
      try {
        const response = await sendMessage(selectedConversationId, { message: { content } })
        setState((current) =>
          appendConversationExchange(
            current,
            response.conversation,
            response.userMessage,
            response.avatarMessage,
            response.session,
          ),
        )
      } catch (error) {
        setSubmitError(formatApiError(error, 'UNKNOWN_ERROR: Failed to send message'))
        setDraftMessage(content)
      } finally {
        setIsSendingMessage(false)
      }
    })()
  }
}

function toAvatarMap(avatars: AvatarSummary[]): Map<string, AvatarSummary> {
  const map = new Map<string, AvatarSummary>()
  for (const avatar of avatars) {
    map.set(avatar.avatarId, avatar)
  }
  return map
}

async function loadAvatars(
  scenarioId: string,
  setAvatars: (avatars: AvatarSummary[]) => void,
  setIsLoadingAvatars: (value: boolean) => void,
  setSubmitError: (value: string | null) => void,
): Promise<void> {
  setSubmitError(null)
  setIsLoadingAvatars(true)

  try {
    setAvatars(await listScenarioAvatars(scenarioId))
  } catch (error) {
    setSubmitError(formatApiError(error, 'UNKNOWN_ERROR: Failed to load avatars'))
  } finally {
    setIsLoadingAvatars(false)
  }
}

async function hydrateSessionState(
  sessionId: string,
  setState: Dispatch<SetStateAction<SessionConsoleState>>,
  setIsLoadingSession: (value: boolean) => void,
  setSubmitError: (value: string | null) => void,
  setSelectedAvatarId: (value: string | null) => void,
): Promise<void> {
  setSubmitError(null)
  setIsLoadingSession(true)

  try {
    const [session, conversations] = await Promise.all([
      getSession(sessionId),
      listSessionConversations(sessionId),
    ])

    setState((current) => replaceSessionConversations(withSession(current, session), conversations))
    const latestConversation = conversations.at(0)
    if (latestConversation !== undefined) {
      setSelectedAvatarId(latestConversation.avatarId)
    }
  } catch (error) {
    setSubmitError(formatApiError(error, 'UNKNOWN_ERROR: Failed to load session detail'))
  } finally {
    setIsLoadingSession(false)
  }
}

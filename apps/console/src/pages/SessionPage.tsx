import { useEffect, useRef, useState } from 'react'
import type { ComponentProps, JSX, RefObject } from 'react'
import { getHistory, resetSession, sendMessage, startSession } from '../api'
import { formatApiError } from '../api/error'
import { LabeledInput } from '../components/LabeledInput'
import { buttonStyle, errorStyle, inputStyle, labelStyle, sectionStyle } from './form-styles'
import {
  avatarMessageStyle,
  chatComposerStyle,
  chatHeaderStyle,
  chatInputStyle,
  messageListStyle,
  resetButtonStyle,
  sendButtonStyle,
  userMessageStyle,
} from './session-styles'

type SessionPageProps = {
  scenarioId: string
  avatarId: string
  sessionId: string | null
  onSessionIdChange: (sessionId: string | null) => void
}

type FormSubmitEvent = Parameters<NonNullable<ComponentProps<'form'>['onSubmit']>>[0]
type LocalMessage = {
  id: string
  role: 'user' | 'avatar'
  content: string
  metadata?: {
    model?: string
    latencyMs?: number
    inputTokens?: number
    outputTokens?: number
  }
}

const pendingMessageId = 'pending-avatar-message'

const toLocalMessageId = (): string => `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
type HistoryMessage = Awaited<ReturnType<typeof getHistory>>['messages'][number]
const isChatHistoryMessage = (message: HistoryMessage): message is HistoryMessage & { role: 'user' | 'avatar' } =>
  message.role === 'user' || message.role === 'avatar'

const toLocalAvatarMetadata = (metadata: HistoryMessage['metadata']): LocalMessage['metadata'] | undefined => {
  if (metadata === undefined) {
    return undefined
  }

  const nextMetadata: LocalMessage['metadata'] = {}
  if (typeof metadata.model === 'string') {
    nextMetadata.model = metadata.model
  }
  if (typeof metadata.latencyMs === 'number') {
    nextMetadata.latencyMs = metadata.latencyMs
  }
  if (typeof metadata.inputTokens === 'number') {
    nextMetadata.inputTokens = metadata.inputTokens
  }
  if (typeof metadata.outputTokens === 'number') {
    nextMetadata.outputTokens = metadata.outputTokens
  }

  return Object.keys(nextMetadata).length > 0 ? nextMetadata : undefined
}

const mapHistoryToLocalMessages = (history: Awaited<ReturnType<typeof getHistory>>): LocalMessage[] =>
  history.messages
    .filter(isChatHistoryMessage)
    .map((message) => {
      const metadata = message.role === 'avatar' ? toLocalAvatarMetadata(message.metadata) : undefined
      return {
        id: message.messageId,
        role: message.role,
        content: message.content,
        ...(metadata !== undefined ? { metadata } : {}),
      }
    })

type StartSessionFormProps = {
  scenarioId: string
  userId: string
  isBusy: boolean
  error: string | null
  onUserIdChange: (value: string) => void
  onSubmit: (event: FormSubmitEvent) => void
}
type ChatPanelProps = {
  sessionId: string
  messages: LocalMessage[]
  draftMessage: string
  isResettingSession: boolean
  isSendingMessage: boolean
  error: string | null
  messageBottomRef: RefObject<HTMLDivElement | null>
  onDraftMessageChange: (value: string) => void
  onReset: () => void
  onSubmit: (event: FormSubmitEvent) => void
}

function StartSessionForm({
  scenarioId,
  userId,
  isBusy,
  error,
  onUserIdChange,
  onSubmit,
}: StartSessionFormProps): JSX.Element {
  return (
    <section style={sectionStyle}>
      <h2 style={{ marginTop: 0 }}>Start Session</h2>
      <p style={{ marginTop: 0, color: '#4b5563' }}>Scenario: {scenarioId}</p>

      <form onSubmit={onSubmit}>
        <fieldset style={{ margin: 0, padding: 0, border: 'none' }} disabled={isBusy}>
          <LabeledInput
            id="session-user-id"
            label="User ID"
            value={userId}
            onChange={onUserIdChange}
            required
            style={inputStyle}
            labelStyle={labelStyle}
          />
          <button type="submit" style={buttonStyle} disabled={isBusy || userId.trim() === ''}>
            {isBusy ? 'Starting…' : 'Start Session'}
          </button>
        </fieldset>
      </form>

      {error !== null && <p style={errorStyle}>{error}</p>}
    </section>
  )
}

function ChatPanel({
  sessionId,
  messages,
  draftMessage,
  isResettingSession,
  isSendingMessage,
  error,
  messageBottomRef,
  onDraftMessageChange,
  onReset,
  onSubmit,
}: ChatPanelProps): JSX.Element {
  return (
    <section style={sectionStyle}>
      <div style={chatHeaderStyle}>
        <strong>Session: {sessionId}</strong>
        <button
          type="button"
          style={resetButtonStyle}
          disabled={isResettingSession || isSendingMessage}
          onClick={onReset}
        >
          {isResettingSession ? 'Resetting…' : 'Reset'}
        </button>
      </div>

      <div style={messageListStyle}>
        {messages.map((message) => (
          <div key={message.id} style={message.role === 'user' ? userMessageStyle : avatarMessageStyle}>
            <strong>{message.role === 'user' ? 'You:' : 'Avatar:'}</strong> {message.content}
          </div>
        ))}
        <div ref={messageBottomRef} />
      </div>

      <form onSubmit={onSubmit} style={chatComposerStyle}>
        <input
          type="text"
          value={draftMessage}
          onChange={(event) => {
            onDraftMessageChange(event.target.value)
          }}
          style={chatInputStyle}
          placeholder="Type a message"
          disabled={isSendingMessage || isResettingSession}
        />
        <button
          type="submit"
          style={sendButtonStyle}
          disabled={isSendingMessage || isResettingSession || draftMessage.trim() === ''}
        >
          {isSendingMessage ? 'Sending…' : 'Send'}
        </button>
      </form>

      {error !== null && <p style={errorStyle}>{error}</p>}
    </section>
  )
}

type SendMessageStateActions = {
  clearError: () => void
  startSending: () => void
  finishSending: () => void
  setError: (error: string) => void
  clearDraft: () => void
  appendMessages: (messages: LocalMessage[]) => void
  replacePendingMessage: (message: LocalMessage) => void
  removePendingMessage: () => void
}
const createSendMessageActions = (
  setSubmitError: (error: string | null) => void,
  setIsSendingMessage: (value: boolean) => void,
  setDraftMessage: (value: string) => void,
  setMessages: (updater: (current: LocalMessage[]) => LocalMessage[]) => void,
): SendMessageStateActions => ({
  clearError: () => {
    setSubmitError(null)
  },
  startSending: () => {
    setIsSendingMessage(true)
  },
  finishSending: () => {
    setIsSendingMessage(false)
  },
  setError: (error) => {
    setSubmitError(error)
  },
  clearDraft: () => {
    setDraftMessage('')
  },
  appendMessages: (nextMessages) => {
    setMessages((current) => [...current, ...nextMessages])
  },
  replacePendingMessage: (message) => {
    setMessages((current) =>
      current.map((currentMessage) => (currentMessage.id === pendingMessageId ? message : currentMessage)),
    )
  },
  removePendingMessage: () => {
    setMessages((current) => current.filter((currentMessage) => currentMessage.id !== pendingMessageId))
  },
})

async function submitSendMessage(
  sessionId: string,
  avatarId: string,
  content: string,
  actions: SendMessageStateActions,
): Promise<void> {
  const optimisticMessage: LocalMessage = { id: toLocalMessageId(), role: 'user', content }
  const pendingMessage: LocalMessage = { id: pendingMessageId, role: 'avatar', content: '…' }

  actions.clearError()
  actions.clearDraft()
  actions.startSending()
  actions.appendMessages([optimisticMessage, pendingMessage])

  try {
    const response = await sendMessage(sessionId, { avatarId, message: { content } })
    actions.replacePendingMessage({
      id: response.avatarMessage.messageId,
      role: 'avatar',
      content: response.avatarMessage.content,
      metadata: {
        model: response.avatarMessage.metadata.model,
        latencyMs: response.avatarMessage.metadata.latencyMs,
        inputTokens: response.avatarMessage.metadata.inputTokens,
        outputTokens: response.avatarMessage.metadata.outputTokens,
      },
    })
  } catch (error) {
    actions.setError(formatApiError(error, 'UNKNOWN_ERROR: Failed to send message'))
    actions.removePendingMessage()
  } finally {
    actions.finishSending()
  }
}

type StartSessionStateActions = {
  clearError: () => void
  startLoading: () => void
  stopLoading: () => void
  setError: (error: string) => void
  setSessionId: (sessionId: string) => void
  setMessagesFromHistory: (messages: LocalMessage[]) => void
}
const createStartSessionActions = (
  setSubmitError: (error: string | null) => void,
  setIsStartingSession: (value: boolean) => void,
  onSessionIdChange: (sessionId: string) => void,
  setMessages: (messages: LocalMessage[]) => void,
): StartSessionStateActions => ({
  clearError: () => {
    setSubmitError(null)
  },
  startLoading: () => {
    setIsStartingSession(true)
  },
  stopLoading: () => {
    setIsStartingSession(false)
  },
  setError: (error) => {
    setSubmitError(error)
  },
  setSessionId: (nextSessionId) => {
    onSessionIdChange(nextSessionId)
  },
  setMessagesFromHistory: (historyMessages) => {
    setMessages(historyMessages)
  },
})

async function submitStartSession(
  scenarioId: string,
  userId: string,
  actions: StartSessionStateActions,
): Promise<void> {
  actions.clearError()
  actions.startLoading()
  try {
    const startedSession = await startSession({ scenarioId, userId })
    actions.setSessionId(startedSession.sessionId)
    const history = await getHistory(startedSession.sessionId)
    actions.setMessagesFromHistory(mapHistoryToLocalMessages(history))
  } catch (error) {
    actions.setError(formatApiError(error, 'UNKNOWN_ERROR: Failed to start session'))
  } finally {
    actions.stopLoading()
  }
}

type ResetSessionStateActions = {
  clearError: () => void
  startResetting: () => void
  finishResetting: () => void
  setError: (error: string) => void
  clearMessages: () => void
  clearSessionId: () => void
}
const createResetSessionActions = (
  setSubmitError: (error: string | null) => void,
  setIsResettingSession: (value: boolean) => void,
  setMessages: (messages: LocalMessage[]) => void,
  onSessionIdChange: (sessionId: string | null) => void,
): ResetSessionStateActions => ({
  clearError: () => {
    setSubmitError(null)
  },
  startResetting: () => {
    setIsResettingSession(true)
  },
  finishResetting: () => {
    setIsResettingSession(false)
  },
  setError: (error) => {
    setSubmitError(error)
  },
  clearMessages: () => {
    setMessages([])
  },
  clearSessionId: () => {
    onSessionIdChange(null)
  },
})

async function submitResetSession(
  sessionId: string,
  actions: ResetSessionStateActions,
): Promise<void> {
  actions.clearError()
  actions.startResetting()
  try {
    await resetSession(sessionId)
    actions.clearMessages()
    actions.clearSessionId()
  } catch (error) {
    actions.setError(formatApiError(error, 'UNKNOWN_ERROR: Failed to reset session'))
  } finally {
    actions.finishResetting()
  }
}

type SessionChatController = {
  userId: string
  draftMessage: string
  messages: LocalMessage[]
  isStartingSession: boolean
  isResettingSession: boolean
  isSendingMessage: boolean
  submitError: string | null
  messageBottomRef: RefObject<HTMLDivElement | null>
  setUserId: (value: string) => void
  setDraftMessage: (value: string) => void
  handleStartSubmit: (event: FormSubmitEvent) => void
  handleSendSubmit: (event: FormSubmitEvent) => void
  handleReset: () => void
}
function useSessionChatController(
  scenarioId: string,
  avatarId: string,
  sessionId: string | null,
  onSessionIdChange: (nextSessionId: string | null) => void,
): SessionChatController {
  const [userId, setUserId] = useState('')
  const [draftMessage, setDraftMessage] = useState('')
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [isStartingSession, setIsStartingSession] = useState(false)
  const [isResettingSession, setIsResettingSession] = useState(false)
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const messageBottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    messageBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleStartSession = async (): Promise<void> => {
    await submitStartSession(
      scenarioId,
      userId,
      createStartSessionActions(setSubmitError, setIsStartingSession, onSessionIdChange, setMessages),
    )
  }

  const handleSendMessage = async (): Promise<void> => {
    if (sessionId === null || draftMessage.trim().length === 0 || isSendingMessage) {
      return
    }

    await submitSendMessage(
      sessionId,
      avatarId,
      draftMessage.trim(),
      createSendMessageActions(setSubmitError, setIsSendingMessage, setDraftMessage, setMessages),
    )
  }

  const handleReset = (): void => {
    if (sessionId === null) {
      return
    }

    void submitResetSession(
      sessionId,
      createResetSessionActions(setSubmitError, setIsResettingSession, setMessages, onSessionIdChange),
    )
  }

  const handleStartSubmit = (event: FormSubmitEvent): void => {
    event.preventDefault()
    void handleStartSession()
  }

  const handleSendSubmit = (event: FormSubmitEvent): void => {
    event.preventDefault()
    void handleSendMessage()
  }

  return {
    userId,
    draftMessage,
    messages,
    isStartingSession,
    isResettingSession,
    isSendingMessage,
    submitError,
    messageBottomRef,
    setUserId,
    setDraftMessage,
    handleStartSubmit,
    handleSendSubmit,
    handleReset,
  }
}

export function SessionPage({
  scenarioId,
  avatarId,
  sessionId,
  onSessionIdChange,
}: SessionPageProps): JSX.Element {
  const controller = useSessionChatController(scenarioId, avatarId, sessionId, onSessionIdChange)

  if (sessionId === null) {
    return (
      <StartSessionForm
        scenarioId={scenarioId}
        userId={controller.userId}
        isBusy={controller.isStartingSession || controller.isResettingSession}
        error={controller.submitError}
        onUserIdChange={controller.setUserId}
        onSubmit={controller.handleStartSubmit}
      />
    )
  }

  return (
    <ChatPanel
      sessionId={sessionId}
      messages={controller.messages}
      draftMessage={controller.draftMessage}
      isResettingSession={controller.isResettingSession}
      isSendingMessage={controller.isSendingMessage}
      error={controller.submitError}
      messageBottomRef={controller.messageBottomRef}
      onDraftMessageChange={controller.setDraftMessage}
      onReset={controller.handleReset}
      onSubmit={controller.handleSendSubmit}
    />
  )
}

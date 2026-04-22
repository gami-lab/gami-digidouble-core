import { useEffect, useRef, useState } from 'react'
import type { ComponentProps, JSX, RefObject } from 'react'
import { getHistory, sendMessage, startConversation, startSession } from '../api'
import { formatApiError } from '../api/error'
import { DebugPanel } from '../components/DebugPanel'
import type { DebugMetadata } from '../components/DebugPanel'
import { LabeledInput } from '../components/LabeledInput'
import { buttonStyle, errorStyle, inputStyle, labelStyle, sectionStyle } from './form-styles'
import {
  avatarMessageStyle,
  chatComposerStyle,
  chatHeaderStyle,
  chatInputStyle,
  messageListStyle,
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
  metadata?: DebugMetadata
}

const generateLocalMessageId = (): string => `local_${crypto.randomUUID()}`
const isBlankMessage = (value: string): boolean => value.trim().length === 0
type HistoryMessage = Awaited<ReturnType<typeof getHistory>>['messages'][number]
const isChatHistoryMessage = (message: HistoryMessage): message is HistoryMessage & { role: 'user' | 'avatar' } =>
  message.role === 'user' || message.role === 'avatar'

const toLocalAvatarMetadata = (metadata: HistoryMessage['metadata']): DebugMetadata | undefined => {
  if (metadata === undefined) {
    return undefined
  }
  const nextMetadata: DebugMetadata = {}
  if (typeof metadata.model === 'string') nextMetadata.model = metadata.model
  if (typeof metadata.latencyMs === 'number') nextMetadata.latencyMs = metadata.latencyMs
  if (typeof metadata.inputTokens === 'number') nextMetadata.inputTokens = metadata.inputTokens
  if (typeof metadata.outputTokens === 'number') nextMetadata.outputTokens = metadata.outputTokens
  return Object.keys(nextMetadata).length > 0 ? nextMetadata : undefined
}

const mapHistoryToLocalMessages = (history: Awaited<ReturnType<typeof getHistory>>): LocalMessage[] =>
  history.messages
    .filter(isChatHistoryMessage)
    .map((message) => {
      const metadata = message.role === 'avatar' ? toLocalAvatarMetadata(message.metadata) : undefined
      const baseMessage: LocalMessage = {
        id: message.messageId,
        role: message.role,
        content: message.content,
      }
      if (metadata !== undefined) {
        baseMessage.metadata = metadata
      }
      return baseMessage
    })

type StartSessionFormProps = {
  scenarioId: string
  userId: string
  isBusy: boolean
  error: string | null
  onUserIdChange: (value: string) => void
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

type ChatPanelProps = {
  sessionId: string
  conversationId: string
  messages: LocalMessage[]
  draftMessage: string
  isSendingMessage: boolean
  isSendDisabled: boolean
  error: string | null
  messageBottomRef: RefObject<HTMLDivElement | null>
  onDraftMessageChange: (value: string) => void
  onSubmit: (event: FormSubmitEvent) => void
}

function ChatPanel({
  sessionId,
  conversationId,
  messages,
  draftMessage,
  isSendingMessage,
  isSendDisabled,
  error,
  messageBottomRef,
  onDraftMessageChange,
  onSubmit,
}: ChatPanelProps): JSX.Element {
  return (
    <section style={sectionStyle}>
      <div style={chatHeaderStyle}>
        <strong>Session: {sessionId}</strong>
        <span>Conversation: {conversationId}</span>
      </div>

      <div style={messageListStyle}>
        {messages.map((message) => (
          <div key={message.id} style={message.role === 'user' ? userMessageStyle : avatarMessageStyle}>
            <strong>{message.role === 'user' ? 'You:' : 'Avatar:'}</strong> {message.content}
            {message.role === 'avatar' && message.metadata !== undefined ? (
              <DebugPanel metadata={message.metadata} />
            ) : null}
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
          disabled={isSendingMessage}
        />
        <button type="submit" style={sendButtonStyle} disabled={isSendingMessage || isSendDisabled}>
          {isSendingMessage ? 'Sending…' : 'Send'}
        </button>
      </form>

      {error !== null && <p style={errorStyle}>{error}</p>}
    </section>
  )
}

export function SessionPage({
  scenarioId,
  avatarId,
  sessionId,
  onSessionIdChange,
}: SessionPageProps): JSX.Element {
  const controller = useSessionPageController(scenarioId, avatarId, sessionId, onSessionIdChange)

  if (sessionId === null || controller.conversationId === null) {
    return (
      <StartSessionForm
        scenarioId={scenarioId}
        userId={controller.userId}
        isBusy={controller.isStartingSession}
        error={controller.submitError}
        onUserIdChange={controller.setUserId}
        onSubmit={controller.handleStartSubmit}
      />
    )
  }

  return (
    <ChatPanel
      sessionId={sessionId}
      conversationId={controller.conversationId}
      messages={controller.messages}
      draftMessage={controller.draftMessage}
      isSendingMessage={controller.isSendingMessage}
      isSendDisabled={controller.isSendDisabled}
      error={controller.submitError}
      messageBottomRef={controller.messageBottomRef}
      onDraftMessageChange={controller.setDraftMessage}
      onSubmit={controller.handleSendSubmit}
    />
  )
}

type SessionPageController = {
  userId: string
  conversationId: string | null
  draftMessage: string
  messages: LocalMessage[]
  isStartingSession: boolean
  isSendingMessage: boolean
  isSendDisabled: boolean
  submitError: string | null
  messageBottomRef: RefObject<HTMLDivElement | null>
  setUserId: (value: string) => void
  setDraftMessage: (value: string) => void
  handleStartSubmit: (event: FormSubmitEvent) => void
  handleSendSubmit: (event: FormSubmitEvent) => void
}

function useSessionPageController(
  scenarioId: string,
  avatarId: string,
  sessionId: string | null,
  onSessionIdChange: (sessionId: string | null) => void,
): SessionPageController {
  const [userId, setUserId] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [draftMessage, setDraftMessage] = useState('')
  const [messages, setMessages] = useState<LocalMessage[]>([])
  const [isStartingSession, setIsStartingSession] = useState(false)
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const messageBottomRef = useRef<HTMLDivElement | null>(null)
  const isSendDisabled = isBlankMessage(draftMessage)

  useEffect(() => {
    messageBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleStartSubmit = (event: FormSubmitEvent): void => {
    event.preventDefault()
    void (async () => {
      setSubmitError(null)
      setIsStartingSession(true)
      try {
        const startedSession = await startSession({ scenarioId, userId })
        onSessionIdChange(startedSession.sessionId)
        const startedConversation = await startConversation(startedSession.sessionId, { avatarId })
        setConversationId(startedConversation.conversationId)
        const history = await getHistory(startedConversation.conversationId)
        setMessages(mapHistoryToLocalMessages(history))
      } catch (error) {
        setSubmitError(formatApiError(error, 'UNKNOWN_ERROR: Failed to start session'))
      } finally {
        setIsStartingSession(false)
      }
    })()
  }

  const handleSendSubmit = (event: FormSubmitEvent): void => {
    event.preventDefault()
    if (conversationId === null || isSendDisabled) {
      return
    }

    const content = draftMessage.trim()
    const optimisticMessage: LocalMessage = { id: generateLocalMessageId(), role: 'user', content }
    setSubmitError(null)
    setDraftMessage('')
    setIsSendingMessage(true)
    setMessages((current) => [...current, optimisticMessage])

    void (async () => {
      try {
        const response = await sendMessage(conversationId, { message: { content } })
        const avatarMetadata = toLocalAvatarMetadata(response.avatarMessage.metadata)
        const avatarMessage: LocalMessage = {
          id: response.avatarMessage.messageId,
          role: 'avatar',
          content: response.avatarMessage.content,
        }
        if (avatarMetadata !== undefined) {
          avatarMessage.metadata = avatarMetadata
        }
        setMessages((current) => [
          ...current.map((message) =>
            message.id === optimisticMessage.id
              ? { id: response.userMessage.messageId, role: 'user' as const, content: response.userMessage.content }
              : message,
          ),
          avatarMessage,
        ])
      } catch (error) {
        setSubmitError(formatApiError(error, 'UNKNOWN_ERROR: Failed to send message'))
        setMessages((current) => current.filter((message) => message.id !== optimisticMessage.id))
      } finally {
        setIsSendingMessage(false)
      }
    })()
  }

  return {
    userId,
    conversationId,
    draftMessage,
    messages,
    isStartingSession,
    isSendingMessage,
    isSendDisabled,
    submitError,
    messageBottomRef,
    setUserId,
    setDraftMessage,
    handleStartSubmit,
    handleSendSubmit,
  }
}
